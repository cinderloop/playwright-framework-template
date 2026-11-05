import { describe, expect, it } from 'vitest';
import {
  compareOperation,
  fillPath,
  formatDriftReport,
  specFingerprint,
  type OpenApiSpec,
} from './openapi';

const spec = {
  info: { version: '5.0.0' },
  components: {
    schemas: { Brand: { type: 'object', properties: { id: { type: 'string' } } } },
    responses: {
      Gone: {
        content: {
          'application/json': { schema: { type: 'object', properties: { message: {} } } },
        },
      },
    },
  },
  paths: {
    '/brands/{id}': {
      get: {
        responses: {
          '200': {
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Brand' } } },
          },
          '204': {},
          '404': { $ref: '#/components/responses/Gone' },
        },
      },
    },
    '/any': { get: { responses: { default: {} } } },
  },
} as OpenApiSpec;

const observed = { method: 'GET', path: '/brands/{id}', status: 200, body: { id: 'a' } };

describe('compareOperation', () => {
  it('finds nothing for a matching response', () => {
    expect(compareOperation(spec, observed)).toEqual({
      operation: 'GET /brands/{id}',
      status: 200,
      drift: [],
    });
  });

  it('reports field drift', () => {
    const { drift } = compareOperation(spec, { ...observed, body: { id: 'a', extra: 1 } });

    expect(drift).toEqual([
      { kind: 'undocumented-field', path: 'extra', detail: 'not in the spec' },
    ]);
  });

  it('reports a status the spec does not list, and what it does list', () => {
    const { drift } = compareOperation(spec, { ...observed, status: 500 });

    expect(drift).toEqual([
      {
        kind: 'undocumented-status',
        path: '-',
        detail: '500 is not documented (documented: 200, 204, 404)',
      },
    ]);
  });

  it('reports an operation the spec does not have', () => {
    const { drift } = compareOperation(spec, { ...observed, method: 'DELETE' });

    expect(drift[0]?.kind).toBe('undocumented-operation');
  });

  it('follows a referenced response', () => {
    const { drift } = compareOperation(spec, { ...observed, status: 404, body: { message: 'x' } });

    expect(drift).toEqual([]);
  });

  it('treats a default response as documenting any status', () => {
    const result = compareOperation(spec, { ...observed, path: '/any', status: 418 });

    expect(result.drift).toEqual([]);
  });

  it('has nothing to compare when a response documents no body', () => {
    expect(compareOperation(spec, { ...observed, status: 204 }).drift).toEqual([]);
  });

  it('has nothing to compare when there is no JSON body', () => {
    expect(compareOperation(spec, { ...observed, body: undefined }).drift).toEqual([]);
  });

  it('fails clearly on a broken reference', () => {
    const broken = {
      paths: {
        '/x': { get: { responses: { '200': { $ref: '#/components/responses/Nope' } } } },
      },
    } as OpenApiSpec;

    expect(() => compareOperation(broken, { ...observed, path: '/x' })).toThrow(
      'Cannot resolve #/components/responses/Nope',
    );
  });
});

describe('fillPath', () => {
  it('replaces every placeholder', () => {
    expect(fillPath('/a/{one}/b/{two}', { one: '1', two: '2' })).toBe('/a/1/b/2');
  });

  it('leaves a path with no placeholders alone', () => {
    expect(fillPath('/a', {})).toBe('/a');
  });

  it('fails clearly when a value is missing', () => {
    expect(() => fillPath('/a/{one}', {})).toThrow('No value for {one} in /a/{one}.');
  });
});

describe('specFingerprint', () => {
  it('is stable for the same text', () => {
    expect(specFingerprint('a')).toBe(specFingerprint('a'));
  });

  it('changes with the text', () => {
    expect(specFingerprint('a')).not.toBe(specFingerprint('b'));
  });
});

describe('formatDriftReport', () => {
  const clean = { operation: 'GET /a', status: 200, drift: [] };
  const drifting = {
    operation: 'GET /b',
    status: 200,
    drift: [{ kind: 'undocumented-field' as const, path: 'x', detail: 'a|b' }],
  };

  it('summarises the run', () => {
    expect(formatDriftReport(spec, [clean, drifting])).toContain(
      'Spec version 5.0.0. 2 responses checked, 1 with drift.',
    );
  });

  it('lists only drift, escaping table cells', () => {
    const report = formatDriftReport(spec, [clean, drifting]);

    expect(report).toContain(String.raw`| GET /b | 200 | undocumented-field | x | a\|b |`);
    expect(report).not.toContain('GET /a');
  });

  it('has no table when nothing drifted', () => {
    expect(formatDriftReport(spec, [clean])).not.toContain('| Operation');
  });
});
