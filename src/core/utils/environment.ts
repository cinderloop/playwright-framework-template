/**
 * Why a test must not run against `current`, or `undefined` if it may. Kept
 * apart from the Playwright guard so it can be unit tested.
 */
export function environmentSkipReason(
  current: string,
  allowed: readonly string[],
): string | undefined {
  if (allowed.includes(current)) return undefined;
  return `Runs only against ${allowed.join(', ')}, not "${current}": these tests are too invasive for a shared environment.`;
}
