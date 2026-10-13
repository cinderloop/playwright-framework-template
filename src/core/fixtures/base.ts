import { test as base } from '@playwright/test';
import { uniqueSuffix } from '../utils';

export interface CoreFixtures {
  /** A value unique to this test, for naming data that must not collide with parallel tests. */
  uniqueId: string;
}

/**
 * Framework-level fixtures shared by every application. App fixtures are
 * merged on top of this with `mergeTests`.
 */
export const test = base.extend<CoreFixtures>({
  uniqueId: async ({}, use, testInfo) => {
    await use(`${String(testInfo.workerIndex)}-${uniqueSuffix()}`);
  },
});

export { expect } from '@playwright/test';
