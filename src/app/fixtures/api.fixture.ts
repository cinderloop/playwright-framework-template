import { mergeTests, type APIRequestContext } from '@playwright/test';
import { test as coreTest } from '@core/fixtures';
import { createToolshopApi, type ToolshopApi } from '@app/api';
import { configTest } from './config.fixture';

export interface ApiFixtures {
  /** Request context for the Toolshop API, disposed after the test. */
  apiRequest: APIRequestContext;
  /** Anonymous API clients. */
  api: ToolshopApi;
  /** API clients signed in as the configured customer. */
  customerApi: ToolshopApi;
  /** API clients signed in as the configured admin. */
  adminApi: ToolshopApi;
  /** API clients for an arbitrary token, e.g. a customer created by the test. */
  apiWithToken: (token: string) => ToolshopApi;
}

// Tokens are fetched per test: Toolshop JWTs live only 5 minutes, so sharing
// one across a worker would expire during longer runs.
export const apiTest = mergeTests(coreTest, configTest).extend<ApiFixtures>({
  // Toolshop's one-time codes and gift card codes are not in the core defaults.
  apiRecorderOptions: { sensitiveKeys: ['totp', 'validation_code'] },

  apiRequest: async ({ playwright }, use) => {
    const context = await playwright.request.newContext();
    await use(context);
    await context.dispose();
  },

  apiWithToken: async ({ apiRequest, apiRecorder, config }, use) => {
    await use((token) =>
      createToolshopApi(apiRequest, { baseUrl: config.apiUrl, token, recorder: apiRecorder }),
    );
  },

  api: async ({ apiRequest, apiRecorder, config }, use) => {
    await use(createToolshopApi(apiRequest, { baseUrl: config.apiUrl, recorder: apiRecorder }));
  },

  customerApi: async ({ api, apiWithToken, config }, use) => {
    const { access_token } = await api.auth.login(config.users.customer);
    await use(apiWithToken(access_token));
  },

  adminApi: async ({ api, apiWithToken, config }, use) => {
    const { access_token } = await api.auth.login(config.users.admin);
    await use(apiWithToken(access_token));
  },
});
