import { expect, test } from '@app/fixtures';

// These tests drive the login form itself; every other test signs in through
// the API-backed storage state written by tests/setup/auth.setup.ts.
test.describe('Login', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test(
    'customer can sign in with valid credentials',
    { tag: ['@smoke', '@regression'] },
    async ({ loginPage, accountPage, config }) => {
      await loginPage.login(config.users.customer);

      await expect(accountPage.heading).toBeVisible();
      await expect(loginPage.heading).toBeHidden();
    },
  );

  test(
    'unknown credentials are rejected with an error',
    { tag: '@regression' },
    async ({ page, loginPage, uniqueId }) => {
      // An unregistered address: wrong passwords for a real account would lock it.
      await loginPage.login({
        email: `nobody-${uniqueId}@example.com`,
        password: 'not-a-password',
      });

      await expect(loginPage.error).toHaveText('Invalid email or password');
      await expect(page).toHaveURL(/\/auth\/login$/);
    },
  );
});
