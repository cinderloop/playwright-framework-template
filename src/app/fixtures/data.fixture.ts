import { CleanupQueue } from '@core/utils';
import { TestData } from '@app/data';
import { apiTest } from './api.fixture';

export interface DataFixtures {
  /** Creates entities via the API and deletes them after the test. */
  testData: TestData;
}

export const dataTest = apiTest.extend<DataFixtures>({
  // Owns its cleanup queue: because this fixture depends on the API clients,
  // they are guaranteed to still be alive when the queue runs.
  testData: async ({ api, adminApi, apiWithToken }, use, testInfo) => {
    const cleanup = new CleanupQueue();
    await use(new TestData({ api, adminApi, apiWithToken, cleanup, testInfo }));
    await cleanup.run();
  },
});
