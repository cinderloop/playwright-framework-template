import { expect, test } from '@app/fixtures';
import { RESET_PASSWORD } from '@app/api';
import { config } from '@app/config';
import type { NewCustomer } from '@app/data';
import type { ToolshopApi } from '@app/api';
import { localOnly, markKnownIssue } from '@core/utils';

const MAX_LOGIN_ATTEMPTS = 3;

async function failLogin(api: ToolshopApi, { credentials }: NewCustomer, times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await api.auth.loginResponse({ ...credentials, password: 'wrong-password' });
  }
}

// Every test uses its own new customer. Locking or resetting a seeded account
// would break every other test that signs in with it.
test.describe('Account security', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test.describe('lockout', () => {
    test('locks an account after repeated failures', async ({ testData, api }) => {
      const customer = await testData.customer();

      await failLogin(api, customer, MAX_LOGIN_ATTEMPTS);

      const response = await api.auth.loginResponse(customer.credentials);
      expect(response.status()).toBe(423);
    });

    test('a successful login clears the count', async ({ testData, api }) => {
      const customer = await testData.customer();

      await failLogin(api, customer, MAX_LOGIN_ATTEMPTS - 1);
      await api.auth.login(customer.credentials);
      await failLogin(api, customer, MAX_LOGIN_ATTEMPTS - 1);

      const response = await api.auth.loginResponse(customer.credentials);
      expect(response.status()).toBe(200);
    });

    test('a locked account has no working sessions', async ({ testData, api }) => {
      const customer = await testData.customer();
      await failLogin(api, customer, MAX_LOGIN_ATTEMPTS);
      const locked = await api.auth.loginResponse(customer.credentials);
      expect(locked.status()).toBe(423);

      const session = await customer.api.auth.meResponse();

      markKnownIssue('F-15', 'a token issued before a lockout keeps working');
      expect(session.status()).toBe(401);
    });

    test('a customer cannot unlock their own account', async ({ testData, api }) => {
      const customer = await testData.customer();
      await failLogin(api, customer, MAX_LOGIN_ATTEMPTS);

      await customer.api.users.patchResponse(customer.user.id, { failed_login_attempts: 0 });
      const response = await api.auth.loginResponse(customer.credentials);
      expect([200, 423]).toContain(response.status());

      markKnownIssue('F-09', 'a locked customer can clear their own lockout');
      expect(response.status()).toBe(423);
    });
  });

  test('a disabled account cannot sign in or use a token', async ({ testData, api, adminApi }) => {
    const customer = await testData.customer();

    const disable = await adminApi.users.patchResponse(customer.user.id, { enabled: false });
    expect(disable.status()).toBe(200);

    const login = await api.auth.loginResponse(customer.credentials);
    expect(login.status()).toBe(403);
    const session = await customer.api.auth.meResponse();
    expect(session.status()).toBe(403);
  });

  test.describe('forgotten password', () => {
    test('a reset does not set a password anyone can guess', async ({ testData, api }) => {
      const { user } = await testData.customer();

      const reset = await api.auth.forgotPasswordResponse(user.email);
      expect(reset.status()).toBe(200);
      const login = await api.auth.loginResponse({ email: user.email, password: RESET_PASSWORD });

      markKnownIssue('F-02', 'anyone can reset an account to a fixed, known password');
      expect(login.status()).toBe(401);
    });

    test('does not reveal whether an email is registered', async ({ testData, api, uniqueId }) => {
      const { user } = await testData.customer();

      const known = await api.auth.forgotPasswordResponse(user.email);
      const unknown = await api.auth.forgotPasswordResponse(`nobody.${uniqueId}@example.com`);

      markKnownIssue('F-21', 'unknown emails answer 422 and registered ones 200');
      expect(unknown.status()).toBe(known.status());
    });
  });
});
