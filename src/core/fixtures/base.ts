import { test as base } from '@playwright/test';
import { ApiRecorder, type ApiRecorderOptions } from '../api';
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
  /** Extra sensitive names and size limits for `apiRecorder`. */
  apiRecorderOptions: ApiRecorderOptions;
  /**
   * Redacted log of this test's API calls, for clients created with it. It is
   * attached to the report only when the test fails or is being retried.
   */
  apiRecorder: ApiRecorder;
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

  apiRecorderOptions: [{}, { option: true }],

  apiRecorder: async ({ apiRecorderOptions }, use, testInfo) => {
    const recorder = new ApiRecorder(apiRecorderOptions);
    await use(recorder);
    const failed = testInfo.status !== testInfo.expectedStatus;
    if (recorder.size > 0 && (failed || testInfo.retry > 0)) {
      await testInfo.attach('api-exchanges', {
        body: JSON.stringify(recorder, null, 2),
        contentType: 'application/json',
      });
    }
  },
});
