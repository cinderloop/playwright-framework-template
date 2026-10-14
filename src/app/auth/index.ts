import type { BrowserContext } from '@playwright/test';
import { storageStatePath } from '@core/auth';
import { AUTH_TOKEN_STORAGE_KEY } from '@app/api';
import type { Role } from '@app/config';

/** Storage state written by tests/setup/auth.setup.ts for each role. */
export function authFile(role: Role): string {
  return storageStatePath(role);
}

/**
 * Signs the browser in with a token obtained through the API, for users a
 * test creates itself (the per-role storage states cover the fixed accounts).
 * Must run before the first navigation.
 */
export async function signInWithToken(context: BrowserContext, token: string): Promise<void> {
  await context.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value);
    },
    [AUTH_TOKEN_STORAGE_KEY, token] as const,
  );
}
