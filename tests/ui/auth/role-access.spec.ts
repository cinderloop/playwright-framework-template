import { authFile } from '@app/auth';
import { expect, test } from '@app/fixtures';

test.describe('Role-based access as customer', () => {
  test.use({ storageState: authFile('customer') });

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
  test.use({ storageState: authFile('admin') });

  test('admin can open the dashboard', { tag: '@regression' }, async ({ adminDashboardPage }) => {
    await adminDashboardPage.goto();

    await expect(adminDashboardPage.heading).toBeVisible();
  });
});
