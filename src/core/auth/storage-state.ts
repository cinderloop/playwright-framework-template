import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { BrowserContext } from '@playwright/test';

export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

const AUTH_DIR = '.auth';

/** Where the setup project writes, and tests read, the storage state for `role`. */
export function storageStatePath(role: string): string {
  return resolve(process.cwd(), AUTH_DIR, `${role}.json`);
}

/**
 * Builds a storage state for apps that keep their session token in
 * localStorage, so a session obtained via the API can be handed to the browser
 * without driving the login UI.
 */
export function localStorageState(origin: string, items: Record<string, string>): StorageState {
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(origin).origin,
        localStorage: Object.entries(items).map(([name, value]) => ({ name, value })),
      },
    ],
  };
}

export async function saveStorageState(path: string, state: StorageState): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2));
}
