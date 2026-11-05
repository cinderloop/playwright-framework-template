import { ToolshopAuthorizationContext } from '@app/authorization';
import { dataTest } from './data.fixture';

export interface AuthorizationFixtures {
  /** Actors and arrange steps for one authorization matrix row. */
  authorizationContext: ToolshopAuthorizationContext;
}

export const authorizationTest = dataTest.extend<AuthorizationFixtures>({
  authorizationContext: async ({ api, adminApi, testData }, use) => {
    await use(new ToolshopAuthorizationContext({ api, adminApi, testData }));
  },
});
