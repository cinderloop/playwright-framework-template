import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { errorMessageSchema } from '@app/schemas';
import { localOnly, markKnownIssue, pollUntil } from '@core/utils';

// Tampered and forged tokens are not covered here; see docs/api-findings.md.
test.describe('Token handling', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('a missing token is refused', async ({ api }) => {
    const response = await api.auth.meResponse();

    expect(response.status()).toBe(401);
    await expect(response).toMatchSchema(errorMessageSchema);
  });

  test('a malformed token is refused', async ({ apiWithToken }) => {
    const response = await apiWithToken('not-a-token').auth.meResponse();

    expect(response.status()).toBe(401);
    await expect(response).toMatchSchema(errorMessageSchema);
  });

  test('a token stops working after logout', async ({ testData }) => {
    const { api } = await testData.customer();

    const logout = await api.auth.logoutResponse();
    expect(logout.status()).toBe(200);

    const after = await api.auth.meResponse();
    expect(after.status()).toBe(401);
  });

  test('refreshing replaces the token', async ({ testData, apiWithToken }) => {
    const { api } = await testData.customer();

    const { access_token: refreshed } = await api.auth.refresh();

    const withOld = await api.auth.meResponse();
    expect(withOld.status()).toBe(401);
    const withNew = await apiWithToken(refreshed).auth.meResponse();
    expect(withNew.status()).toBe(200);
  });

  test('refreshing without a token is refused', async ({ api }) => {
    const response = await api.auth.refreshResponse();
    expect([401, 500]).toContain(response.status());

    markKnownIssue('F-17', 'GET /users/refresh with no token answers 500 and a stack trace');
    expect(response.status()).toBe(401);
  });

  test('changing the password ends existing sessions', async ({ testData }) => {
    const { api, credentials } = await testData.customer();

    const change = await api.auth.changePasswordResponse(
      credentials.password,
      `${credentials.password}Zz9!`,
    );
    expect(change.status()).toBe(200);
    const after = await api.auth.meResponse();

    markKnownIssue('F-15', 'a token issued before a password change keeps working');
    expect(after.status()).toBe(401);
  });

  // Uses the seeded customer, not `testData`: cleanup needs an admin token, and
  // one fetched at the start of this test would have expired by the end.
  test('a token expires, and can then be refreshed', async ({ api, apiWithToken }) => {
    test.setTimeout(400_000);

    const startedAt = Date.now();
    const { access_token: token, expires_in: lifetime } = await api.auth.login(
      config.users.customer,
    );
    const client = apiWithToken(token);

    const expired = await pollUntil(
      () => client.auth.meResponse(),
      (response) => response.status() === 401,
      {
        description: 'the token to expire',
        timeout: (lifetime + 30) * 1_000,
        intervals: [10_000],
      },
    );

    await expect(expired).toMatchSchema(errorMessageSchema);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual((lifetime - 5) * 1_000);

    const { access_token: refreshed } = await client.auth.refresh();
    const withNew = await apiWithToken(refreshed).auth.meResponse();
    expect(withNew.status()).toBe(200);
  });
});
