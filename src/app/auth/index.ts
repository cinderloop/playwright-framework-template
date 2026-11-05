import type { BrowserContext } from '@playwright/test';
import { AUTH_TOKEN_STORAGE_KEY } from '@app/api';

/**
 * Signs the browser in with a token obtained through the API. Must run before
 * the first navigation. For the configured roles, use the `signInAs` fixture.
 */
export async function signInWithToken(context: BrowserContext, token: string): Promise<void> {
  await context.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [AUTH_TOKEN_STORAGE_KEY, token] as const,
  );
}
