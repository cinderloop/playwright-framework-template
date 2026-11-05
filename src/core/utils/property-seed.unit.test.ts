import { describe, expect, it } from 'vitest';
import { resolvePropertySeed } from './property-seed';

describe('resolvePropertySeed', () => {
  it('uses the fallback when nothing is set', () => {
    expect(resolvePropertySeed(undefined, 7)).toBe(7);
  });

  it('treats an empty value as unset', () => {
    expect(resolvePropertySeed('', 7)).toBe(7);
  });

  it('uses the given seed, including negative ones from fast-check', () => {
    expect(resolvePropertySeed('-1234', 7)).toBe(-1234);
  });

  it('accepts zero', () => {
    expect(resolvePropertySeed('0', 7)).toBe(0);
  });

  it.each(['abc', '1.5'])('rejects %s rather than quietly ignoring it', (value) => {
    expect(() => resolvePropertySeed(value, 7)).toThrow('PROPERTY_SEED must be a whole number');
  });
});
