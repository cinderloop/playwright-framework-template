import { test } from '@playwright/test';
import { environmentSkipReason } from './environment';

/**
 * Skips the enclosing test or `describe` unless `current` is an allowed
 * environment. The caller passes its resolved environment, because only the
 * application layer knows its default when `TEST_ENV` is unset.
 */
export function skipUnless(current: string, ...allowed: string[]): void {
  const reason = environmentSkipReason(current, allowed);
  test.skip(reason !== undefined, reason);
}

/** For security probes, concurrency and property-based suites. */
export function localOnly(current: string): void {
  skipUnless(current, 'local');
}
