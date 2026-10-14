import { fileURLToPath } from 'node:url';

export type { FlakySummaryOptions } from './flaky-summary.reporter';

/** Path of the flaky-test summary reporter, for the `reporter` list in a Playwright config. */
export const flakySummaryReporter = fileURLToPath(
  new URL('./flaky-summary.reporter.ts', import.meta.url),
);
