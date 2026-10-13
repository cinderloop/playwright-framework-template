import { expect, test } from '@app/fixtures';

test.describe('Catalog changes made through the API', () => {
  test(
    'a new product can be found by search and shows its details',
    { tag: '@regression' },
    async ({ testData, productListingPage, productDetailPage }) => {
      const product = await testData.product();

      await productListingPage.goto();
      await productListingPage.search(product.name);

      await expect(productListingPage.productNames).toHaveText([product.name]);
      await productListingPage.productCard(product.name).open();
      await expect(productDetailPage.name).toHaveText(product.name);
      await expect(productDetailPage.unitPrice).toHaveText(product.price.toFixed(2));
      await expect(productDetailPage.description).toHaveText(product.description ?? '');
    },
  );

  test(
    'a deleted product disappears from search',
    { tag: '@regression' },
    async ({ testData, adminApi, productListingPage }) => {
      const product = await testData.product();
      expect((await adminApi.products.deleteResponse(product.id)).status()).toBe(204);

      await productListingPage.goto();
      await productListingPage.search(product.name);

      await expect(productListingPage.noResults).toBeVisible();
    },
  );

  test(
    'a product without stock cannot be added to the cart',
    { tag: '@regression' },
    async ({ testData, productDetailPage }) => {
      const product = await testData.product({ stock: 0 });

      await productDetailPage.goto(product.id);

      await expect(productDetailPage.name).toHaveText(product.name);
      await expect(productDetailPage.outOfStock).toBeVisible();
      await expect(productDetailPage.addToCartButton).toBeDisabled();
    },
  );
});
