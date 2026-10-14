import { scanAccessibility, summarizeViolations } from '@core/a11y';
import { a11yBaseline, type A11yPage } from '@app/a11y/baseline';
import { expect, test } from '@app/fixtures';
import type { Page } from '@playwright/test';

/** How to reach each page in a fully rendered state. */
const pages: Record<A11yPage, (page: Page) => Promise<void>> = {
  home: async (page) => {
    await page.goto('/');
    await expect(page.getByTestId('product-name').first()).toBeVisible();
  },
  productDetail: async (page) => {
    await pages.home(page);
    await page.getByTestId('product-name').first().click();
    await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
  },
  cart: async (page) => {
    await pages.productDetail(page);
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByTestId('cart-quantity')).toHaveText('1');
    await page.goto('/checkout');
    await expect(page.getByRole('button', { name: 'Proceed to checkout' })).toBeVisible();
  },
  login: async (page) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('button', { name: 'Login' })).toBeVisible();
  },
  register: async (page) => {
    await page.goto('/auth/register');
    await expect(page.getByRole('heading', { name: 'Customer registration' })).toBeVisible();
  },
  contact: async (page) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible();
  },
};

test.describe('Accessibility (WCAG 2.1 AA)', { tag: '@a11y' }, () => {
  for (const [name, open] of Object.entries(pages) as [A11yPage, (page: Page) => Promise<void>][]) {
    test(`${name} has no violations beyond the baseline`, async ({ page }, testInfo) => {
      await open(page);

      const { unexpected, stale } = await scanAccessibility(page, testInfo, {
        baseline: a11yBaseline[name],
      });

      for (const { rule } of stale) {
        testInfo.annotations.push({
          type: 'a11y-baseline-stale',
          description: `${rule} no longer fails on ${name}; remove it from the baseline`,
        });
      }
      expect(summarizeViolations(unexpected)).toEqual([]);
    });
  }
});
