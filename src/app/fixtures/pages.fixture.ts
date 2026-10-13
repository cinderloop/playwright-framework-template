import { test as base } from '@playwright/test';
import {
  AccountPage,
  AdminDashboardPage,
  CartPage,
  LoginPage,
  ProductDetailPage,
  ProductListingPage,
} from '@app/pages';

export interface PageFixtures {
  productListingPage: ProductListingPage;
  productDetailPage: ProductDetailPage;
  cartPage: CartPage;
  loginPage: LoginPage;
  accountPage: AccountPage;
  adminDashboardPage: AdminDashboardPage;
}

export const pagesTest = base.extend<PageFixtures>({
  productListingPage: async ({ page }, use) => {
    await use(new ProductListingPage(page));
  },
  productDetailPage: async ({ page }, use) => {
    await use(new ProductDetailPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  accountPage: async ({ page }, use) => {
    await use(new AccountPage(page));
  },
  adminDashboardPage: async ({ page }, use) => {
    await use(new AdminDashboardPage(page));
  },
});
