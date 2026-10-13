import type { APIRequestContext } from '@playwright/test';
import type { Credentials } from '@app/config';
import { loginResponseSchema, type LoginResponse } from '@app/schemas/auth.schema';

/** Key the Toolshop Angular app reads its JWT from in localStorage. */
export const AUTH_TOKEN_STORAGE_KEY = 'auth-token';

export async function loginViaApi(
  request: APIRequestContext,
  apiUrl: string,
  credentials: Credentials,
): Promise<LoginResponse> {
  const response = await request.post(new URL('/users/login', apiUrl).href, { data: credentials });
  if (!response.ok()) {
    throw new Error(
      `API login for ${credentials.email} failed: ${String(response.status())} ${await response.text()}`,
    );
  }
  return loginResponseSchema.parse(await response.json());
}
