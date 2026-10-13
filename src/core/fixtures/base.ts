import { test as base } from '@playwright/test';
import { CleanupQueue, uniqueSuffix } from '../utils';

export type Cleanup = Pick<CleanupQueue, 'add'>;

export interface CoreFixtures {
  /** A value unique to this test, for naming data that must not collide with parallel tests. */
  uniqueId: string;
  /**
   * Registers teardown work that runs after the test, even if it fails.
   * Tasks that need other fixtures (e.g. an API context) should live in a
   * fixture that depends on those, so they are still alive at teardown.
   */
  cleanup: Cleanup;
}

/**
 * Framework-level fixtures shared by every application. App fixtures are
 * merged on top of this with `mergeTests`.
 */
export const test = base.extend<CoreFixtures>({
  uniqueId: async ({}, use, testInfo) => {
    await use(`${String(testInfo.workerIndex)}-${uniqueSuffix()}`);
  },

  cleanup: async ({}, use) => {
    const queue = new CleanupQueue();
    await use(queue);
    await queue.run();
  },
});
