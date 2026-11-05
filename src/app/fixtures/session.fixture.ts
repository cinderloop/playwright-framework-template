import { signInWithToken } from '@app/auth';
import type { Role } from '@app/config';
import { apiTest } from './api.fixture';

export interface SessionFixtures {
  /** Signs the browser in as a configured role. Call it before the first navigation. */
  signInAs: (role: Role) => Promise<void>;
}

// A fresh token per test: Toolshop's last five minutes, and in a full run a browser
// test can start later than that (ADR 0015).
export const sessionTest = apiTest.extend<SessionFixtures>({
  signInAs: async ({ api, config, context }, use) => {
    await use(async (role) => {
      const { access_token: token } = await api.auth.login(config.users[role]);
      await signInWithToken(context, token);
    });
  },
});
