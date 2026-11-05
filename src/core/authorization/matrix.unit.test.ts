import type { APIResponse } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import {
  buildMatrix,
  expandEntry,
  isAssertionFailure,
  type AuthorizationContext,
  type KnownIssue,
  type MatrixEntry,
} from './matrix';

type Actor = 'anonymous' | 'owner' | 'admin';
type Client = (path: string) => Promise<APIResponse>;
type Context = AuthorizationContext<Actor, Client> & { calls: string[] };

function context(status = 200): Context {
  const calls: string[] = [];
  return {
    calls,
    actor: (name) => {
      calls.push(`actor:${name}`);
      return Promise.resolve((path) => {
        calls.push(`request:${path}`);
        return Promise.resolve({ status: () => status } as unknown as APIResponse);
      });
    },
  };
}

function entry(
  expectations: MatrixEntry<Actor, Client, Context, string>['expectations'],
  name = 'GET /things/{id}',
): MatrixEntry<Actor, Client, Context, string> {
  return {
    name,
    arrange: (ctx) => {
      ctx.calls.push('arrange');
      return Promise.resolve('thing-1');
    },
    request: (client, resource) => client(`/things/${resource}`),
    expectations,
  };
}

const issue: KnownIssue = { finding: 'F-01', description: 'leak', observedStatus: 200 };

describe('expandEntry', () => {
  it('creates one row per actor, in declaration order', () => {
    const rows = expandEntry(entry({ anonymous: 401, owner: 200, admin: 200 }));

    expect(rows.map((row) => row.actor)).toEqual(['anonymous', 'owner', 'admin']);
  });

  it('skips actors with no expectation', () => {
    expect(expandEntry(entry({ owner: 200 }))).toHaveLength(1);
  });

  it('writes the expected status into a readable title', () => {
    const [row] = expandEntry(entry({ owner: 200 }));

    expect(row?.title).toBe('GET /things/{id} as owner → 200');
  });

  it('lists every acceptable status', () => {
    const [row] = expandEntry(entry({ owner: [403, 404] }));

    expect(row?.title).toBe('GET /things/{id} as owner → 403/404');
    expect(row?.statuses).toEqual([403, 404]);
  });

  it('accepts the detailed form', () => {
    const [row] = expandEntry(entry({ owner: { status: [403, 404], knownIssue: issue } }));

    expect(row?.statuses).toEqual([403, 404]);
    expect(row?.knownIssue).toEqual(issue);
  });

  it('prefers a label in the title', () => {
    const [row] = expandEntry(entry({ owner: { status: 200, label: 'denied' } }));

    expect(row?.title).toBe('GET /things/{id} as owner → denied');
    expect(row?.statuses).toEqual([200]);
  });

  it('rejects an empty status list', () => {
    expect(() => expandEntry(entry({ owner: [] }))).toThrow('no acceptable status');
  });

  it('rejects a known issue that could never fail', () => {
    const accepted = { status: 200, knownIssue: issue };

    expect(() => expandEntry(entry({ owner: accepted }))).toThrow('nothing else can fail');
  });

  it('allows that status when a verify step can still fail', () => {
    const verified = { status: 200, knownIssue: issue, verify: () => Promise.resolve() };

    expect(expandEntry(entry({ owner: verified }))).toHaveLength(1);
  });
});

describe('perform', () => {
  it('arranges, resolves the actor, then sends the request', async () => {
    const ctx = context(404);
    const [row] = expandEntry(entry({ owner: 404 }));

    const outcome = await row?.perform(ctx);

    expect(ctx.calls).toEqual(['arrange', 'actor:owner', 'request:/things/thing-1']);
    expect(outcome?.status).toBe(404);
  });

  it('arranges afresh for every row', async () => {
    const ctx = context();
    const rows = expandEntry(entry({ owner: 200, admin: 200 }));

    for (const row of rows) await row.perform(ctx);

    expect(ctx.calls.filter((call) => call === 'arrange')).toHaveLength(2);
  });

  it('passes the resource and response to verify', async () => {
    const seen: unknown[] = [];
    const verify = ({ resource, response }: { resource: string; response: APIResponse }) => {
      seen.push(resource, response.status());
      return Promise.resolve();
    };
    const [row] = expandEntry(entry({ owner: { status: 200, verify } }));

    const outcome = await row?.perform(context());
    await outcome?.verify();

    expect(seen).toEqual(['thing-1', 200]);
  });

  it('has a harmless verify when none was declared', async () => {
    const [row] = expandEntry(entry({ owner: 200 }));

    const outcome = await row?.perform(context());

    await expect(outcome?.verify()).resolves.toBeUndefined();
  });

  it('lets an arrange failure reach the caller', async () => {
    const broken = {
      ...entry({ owner: 200 }),
      arrange: () => Promise.reject(new Error('arrange broke')),
    };
    const [row] = expandEntry(broken);

    await expect(row?.perform(context())).rejects.toThrow('arrange broke');
  });
});

describe('buildMatrix', () => {
  it('flattens entries in order', () => {
    const rows = buildMatrix(
      expandEntry(entry({ owner: 200 }, 'GET /a')),
      expandEntry(entry({ owner: 200 }, 'GET /b')),
    );

    expect(rows.map((row) => row.title)).toEqual([
      'GET /a as owner → 200',
      'GET /b as owner → 200',
    ]);
  });

  it('rejects duplicate titles', () => {
    expect(() =>
      buildMatrix(expandEntry(entry({ owner: 200 })), expandEntry(entry({ owner: 200 }))),
    ).toThrow('Duplicate authorization row: GET /things/{id} as owner → 200');
  });
});

describe('isAssertionFailure', () => {
  it('recognises a failed assertion', () => {
    const failure = Object.assign(new Error('expected'), { matcherResult: { pass: false } });

    expect(isAssertionFailure(failure)).toBe(true);
  });

  it('does not excuse an ordinary error, such as a broken response', () => {
    expect(isAssertionFailure(new SyntaxError('Unexpected token'))).toBe(false);
  });

  it.each([null, undefined, 'failed'])('handles the non-error %s', (value) => {
    expect(isAssertionFailure(value)).toBe(false);
  });
});
