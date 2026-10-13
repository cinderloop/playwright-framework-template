import { expect, test } from '@app/fixtures';

test.describe('Search and filters', () => {
  test.beforeEach(async ({ productListingPage }) => {
    await productListingPage.goto();
  });

  test(
    'searching by keyword shows only matching products',
    { tag: ['@smoke', '@regression'] },
    async ({ productListingPage }) => {
      await productListingPage.search('pliers');

      await expect(productListingPage.searchCaption).toHaveText('Searched for: pliers');
      await expect(productListingPage.productNames.first()).toBeVisible();
      await expect(productListingPage.productNames.filter({ hasNotText: /pliers/i })).toHaveCount(
        0,
      );
    },
  );

  test(
    'searching for an unknown product shows an empty state',
    { tag: '@regression' },
    async ({ productListingPage, uniqueId }) => {
      await productListingPage.search(`no-such-tool-${uniqueId}`);

      await expect(productListingPage.noResults).toHaveText('There are no products found.');
      await expect(productListingPage.productCards).toHaveCount(0);
    },
  );

  test(
    'filtering by category shows only products from that category',
    { tag: '@regression' },
    async ({ productListingPage }) => {
      await productListingPage.filterByCategory('Hammer');

      await expect(productListingPage.productNames.first()).toBeVisible();
      await expect(productListingPage.productNames.filter({ hasNotText: /hammer/i })).toHaveCount(
        0,
      );
    },
  );

  test(
    'sorting by price low to high orders the products by ascending price',
    { tag: '@regression' },
    async ({ productListingPage }) => {
      await productListingPage.sortBy('Price (Low - High)');

      await expect(async () => {
        const prices = await productListingPage.visiblePrices();
        expect(prices.length).toBeGreaterThan(1);
        expect(prices).toEqual(prices.toSorted((a, b) => a - b));
      }).toPass();
    },
  );
});
