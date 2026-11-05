import { describe, expect, it } from 'vitest';
import { createRedactor, REDACTED, truncateBody } from './redact';

const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';

describe('headers', () => {
  const redactor = createRedactor();

  it.each(['Authorization', 'authorization', 'Cookie', 'Set-Cookie', 'X-Api-Key', 'X-CSRF-Token'])(
    'masks %s',
    (name) => {
      expect(redactor.headers({ [name]: 'value' })).toEqual({ [name]: REDACTED });
    },
  );

  it('keeps ordinary headers', () => {
    const headers = { 'content-type': 'application/json', 'x-ratelimit-limit': '60' };
    expect(redactor.headers(headers)).toEqual(headers);
  });

  it('masks a token in an otherwise ordinary header', () => {
    expect(redactor.headers({ 'x-debug': `seen ${jwt}` })).toEqual({
      'x-debug': `seen ${REDACTED}`,
    });
  });
});

describe('body', () => {
  const redactor = createRedactor();

  it.each([
    'password',
    'current_password',
    'new_password_confirmation',
    'access_token',
    'accessToken',
    'totp_secret',
    'credit_card_number',
    'gift_card_number',
    'account_number',
    'cvv',
    'API-KEY',
  ])('masks %s', (key) => {
    expect(redactor.body({ [key]: 'value' })).toEqual({ [key]: REDACTED });
  });

  it('masks at any depth, including inside arrays', () => {
    const body = { data: [{ payment: { details: { cvv: '123', holder: 'A' } } }] };
    expect(redactor.body(body)).toEqual({
      data: [{ payment: { details: { cvv: REDACTED, holder: 'A' } } }],
    });
  });

  it('masks non-string values under a sensitive key', () => {
    expect(redactor.body({ token: { nested: 'x' }, password: 12_345 })).toEqual({
      token: REDACTED,
      password: REDACTED,
    });
  });

  it('keeps null, so an absent secret stays visibly absent', () => {
    expect(redactor.body({ token: null })).toEqual({ token: null });
  });

  it('parses JSON strings so the result stays readable', () => {
    expect(redactor.body('{"email":"a@example.com","password":"x"}')).toEqual({
      email: 'a@example.com',
      password: REDACTED,
    });
  });

  it('masks a JWT under an innocent key', () => {
    expect(redactor.body({ note: `issued ${jwt}` })).toEqual({ note: `issued ${REDACTED}` });
  });

  it('describes binary bodies without including them', () => {
    expect(redactor.body(new Uint8Array(3))).toBe('[binary, 3 bytes]');
  });

  it('names a class instance rather than walking into it', () => {
    class ApiResponseLike {
      self = this;
    }

    expect(redactor.body({ response: new ApiResponseLike() })).toEqual({
      response: '[ApiResponseLike]',
    });
  });

  it('handles an object with no prototype', () => {
    const body = Object.assign(Object.create(null) as object, { password: 'x' });

    expect(redactor.body(body)).toEqual({ password: REDACTED });
  });

  it('leaves ordinary values untouched', () => {
    const body = { id: 1, in_stock: true, tags: ['a'], price: 9.99, missing: null };
    expect(redactor.body(body)).toEqual(body);
  });

  it('does not change its input', () => {
    const body = { password: 'x' };
    redactor.body(body);
    expect(body).toEqual({ password: 'x' });
  });
});

describe('text', () => {
  const redactor = createRedactor();

  it('masks form-encoded values', () => {
    expect(redactor.text('email=a%40b.c&password=hunter2&x=1')).toBe(
      `email=a%40b.c&password=${REDACTED}&x=1`,
    );
  });

  it('masks bearer tokens whatever their form', () => {
    expect(redactor.text('sent Bearer abc123 ok')).toBe(`sent Bearer ${REDACTED} ok`);
  });

  it('leaves the bearer token type alone', () => {
    expect(redactor.text('type is bearer')).toBe('type is bearer');
  });

  it('masks a whole quoted value in JSON that cannot be parsed', () => {
    expect(redactor.text('{"password":"two words","id":1')).toBe(`{"password":${REDACTED},"id":1`);
  });

  it('handles an escaped quote inside a value', () => {
    expect(redactor.text(String.raw`"password":"a\"b c"`)).toBe(`"password":${REDACTED}`);
  });

  it('stays fast on a very long run of word characters', () => {
    const started = performance.now();

    redactor.text('A'.repeat(200_000));

    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('matches separators a name is written with', () => {
    expect(redactor.text('api_key=abc api-key=def')).toBe(
      `api_key=${REDACTED} api-key=${REDACTED}`,
    );
  });
});

describe('url', () => {
  const redactor = createRedactor();

  it('masks sensitive query parameters and keeps the rest', () => {
    expect(redactor.url('https://api.test/users?page=2&access_token=abc')).toBe(
      `https://api.test/users?page=2&access_token=${REDACTED}`,
    );
  });

  it('drops credentials embedded in the URL', () => {
    expect(redactor.url('https://user:hunter2@api.test/users')).toBe('https://api.test/users');
  });

  it('masks a token in the path', () => {
    expect(redactor.url(`https://api.test/verify/${jwt}`)).toBe(
      `https://api.test/verify/${REDACTED}`,
    );
  });

  it('falls back to text for something that is not a URL', () => {
    expect(redactor.url(`not a url ${jwt}`)).toBe(`not a url ${REDACTED}`);
  });
});

describe('configured keys', () => {
  it('adds to the defaults rather than replacing them', () => {
    const redactor = createRedactor({ sensitiveKeys: ['validation_code'] });
    expect(redactor.body({ validation_code: '1', password: '2', id: 3 })).toEqual({
      validation_code: REDACTED,
      password: REDACTED,
      id: 3,
    });
  });

  it('ignores a key that normalises to nothing, which would match every name', () => {
    const redactor = createRedactor({ sensitiveKeys: ['--'] });
    expect(redactor.body({ id: 1 })).toEqual({ id: 1 });
  });
});

describe('truncateBody', () => {
  it('returns a body within the limit unchanged', () => {
    const body = { id: 1 };
    expect(truncateBody(body, 100)).toBe(body);
  });

  it('shortens a long string and says how much was removed', () => {
    expect(truncateBody('a'.repeat(15), 10)).toBe(`${'a'.repeat(10)}... [truncated 5 characters]`);
  });

  it('measures objects by their JSON', () => {
    expect(truncateBody({ text: 'a'.repeat(50) }, 10)).toMatch(/^\{"text":"a\.\.\. \[truncated/);
  });

  it('leaves undefined alone', () => {
    expect(truncateBody(undefined, 10)).toBeUndefined();
  });
});
