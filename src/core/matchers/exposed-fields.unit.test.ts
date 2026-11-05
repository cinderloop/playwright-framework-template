import { describe, expect, it } from 'vitest';
import { findExposedFields } from './exposed-fields';

describe('findExposedFields', () => {
  it('finds a top-level field', () => {
    expect(findExposedFields({ password: 'x', id: 1 }, ['password'])).toEqual(['password']);
  });

  it('finds fields at any depth and reports the path', () => {
    const body = { data: [{ id: 1 }, { payment: { details: { cvv: '123' } } }] };

    expect(findExposedFields(body, ['cvv'])).toEqual(['data[1].payment.details.cvv']);
  });

  it('finds every occurrence', () => {
    const body = { data: [{ cvv: 'a' }, { cvv: 'b' }] };

    expect(findExposedFields(body, ['cvv'])).toEqual(['data[0].cvv', 'data[1].cvv']);
  });

  it('ignores case', () => {
    expect(findExposedFields({ Password: 'x' }, ['PASSWORD'])).toEqual(['Password']);
  });

  it('counts a null value, because the name alone shows the column is serialised', () => {
    expect(findExposedFields({ totp_secret: null }, ['totp_secret'])).toEqual(['totp_secret']);
  });

  it('keeps looking inside a matching field', () => {
    expect(findExposedFields({ user: { user: 1 } }, ['user'])).toEqual(['user', 'user.user']);
  });

  it('matches whole names only', () => {
    expect(findExposedFields({ password_hint: 'x' }, ['password'])).toEqual([]);
  });

  it('ignores a matching value', () => {
    expect(findExposedFields({ id: 1, tags: ['password'] }, ['password'])).toEqual([]);
  });

  it.each([null, undefined, 'password', 1])('handles the non-object %s', (value) => {
    expect(findExposedFields(value, ['password'])).toEqual([]);
  });

  it('searches a top-level array', () => {
    expect(findExposedFields([{ cvv: '1' }], ['cvv'])).toEqual(['[0].cvv']);
  });
});
