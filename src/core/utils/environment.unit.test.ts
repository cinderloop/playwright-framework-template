import { describe, expect, it } from 'vitest';
import { environmentSkipReason } from './environment';

describe('environmentSkipReason', () => {
  it('allows a listed environment', () => {
    expect(environmentSkipReason('local', ['local'])).toBeUndefined();
  });

  it('explains why any other environment is skipped', () => {
    expect(environmentSkipReason('public', ['local', 'staging'])).toBe(
      'Runs only against local, staging, not "public": these tests are too invasive for a shared environment.',
    );
  });

  it('allows nothing when the list is empty', () => {
    expect(environmentSkipReason('local', [])).toBeDefined();
  });
});
