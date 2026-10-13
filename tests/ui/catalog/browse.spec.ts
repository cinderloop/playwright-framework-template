import { expect, test } from '@app/fixtures';

test.describe('Product catalog', () => {
  test.beforeEach(async ({ productListingPage }) => {
    await productListingPage.goto();
  });

  test(
    'home page lists products with name and price',
    { tag: ['@smoke', '@regression'] },
    async ({ productListingPage }) => {
      await expect(productListingPage.productCards).toHaveCount(9);
      await expect(productListingPage.productNames.first()).not.toBeEmpty();
      await expect(productListingPage.productPrices.first()).toHaveText(/^\$\d+\.\d{2}$/);
    },
  );

  test(
    'opening a product shows its detail page',
    { tag: ['@smoke', '@regression'] },
    async ({ productListingPage, productDetailPage }) => {
      const card = productListingPage.cardAt(0);
      const name = (await card.name.textContent())?.trim() ?? '';
      const price = (await card.price.textContent())?.trim() ?? '';

      await card.open();

      await expect(productDetailPage.name).toHaveText(name);
      await expect(productDetailPage.unitPrice).toHaveText(price.replace('$', ''));
      await expect(productDetailPage.addToCartButton).toBeEnabled();
    },
  );
});
