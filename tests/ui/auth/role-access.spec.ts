import { signInWithToken } from '@app/auth';
import { expect, test } from '@app/fixtures';

// These sign in per test rather than with a stored state. Toolshop tokens last five
// minutes, and browser tests can start later than that in a full run.

test.describe('Role-based access as customer', () => {
  test.beforeEach(async ({ api, config, context }) => {
    const { access_token: token } = await api.auth.login(config.users.customer);
    await signInWithToken(context, token);
  });

  test(
    'customer is redirected away from the admin area',
    { tag: ['@smoke', '@regression'] },
    async ({ page, adminDashboardPage, loginPage }) => {
      await adminDashboardPage.goto();

      await expect(page).toHaveURL(/\/auth\/login$/);
      await expect(loginPage.heading).toBeVisible();
      await expect(adminDashboardPage.heading).toBeHidden();
    },
  );
});

test.describe('Role-based access as admin', () => {
  test.beforeEach(async ({ api, config, context }) => {
    const { access_token: token } = await api.auth.login(config.users.admin);
    await signInWithToken(context, token);
  });

  test('admin can open the dashboard', { tag: '@regression' }, async ({ adminDashboardPage }) => {
    await adminDashboardPage.goto();

    await expect(adminDashboardPage.heading).toBeVisible();
  });
});
