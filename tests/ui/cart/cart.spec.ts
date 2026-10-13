import { expect, test } from '@app/fixtures';

// The cart lives in sessionStorage, so every test starts with its own empty cart.
test.describe('Shopping cart', () => {
  test.beforeEach(async ({ productListingPage }) => {
    await productListingPage.goto();
    await productListingPage.cardAt(0).open();
  });

  test(
    'adding a product puts it in the cart',
    { tag: ['@smoke', '@regression'] },
    async ({ productDetailPage, cartPage }) => {
      const name = (await productDetailPage.name.textContent())?.trim() ?? '';

      await test.step('add the product from its detail page', async () => {
        await productDetailPage.addToCart(2);
        await expect(productDetailPage.addedToCartToast).toBeVisible();
        await expect(productDetailPage.nav.cartQuantity).toHaveText('2');
      });

      await test.step('the cart lists the product with that quantity', async () => {
        await productDetailPage.nav.openCart();
        await expect(cartPage.items).toHaveCount(1);
        await expect(cartPage.item(name).title).toHaveText(name);
        await expect(cartPage.item(name).quantity).toHaveValue('2');
      });
    },
  );

  test(
    'changing the quantity recalculates the line and cart totals',
    { tag: '@regression' },
    async ({ productDetailPage, cartPage }) => {
      const name = (await productDetailPage.name.textContent())?.trim() ?? '';
      const unitPrice = Number(await productDetailPage.unitPrice.textContent());
      const expectedTotal = `$${(unitPrice * 3).toFixed(2)}`;

      await productDetailPage.addToCart();
      await expect(productDetailPage.nav.cartQuantity).toHaveText('1');
      await cartPage.goto();

      await cartPage.setQuantity(name, 3);

      await expect(cartPage.quantityUpdatedToast).toBeVisible();
      await expect(cartPage.item(name).linePrice).toHaveText(expectedTotal);
      await expect(cartPage.total).toHaveText(expectedTotal);
    },
  );
});
