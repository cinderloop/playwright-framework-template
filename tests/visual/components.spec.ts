import { isRunningInPlaywrightImage } from '@core/utils';
import { expect, test } from '@app/fixtures';

// Baselines are generated and compared only in the official Playwright Docker
// image so fonts and rendering match on every machine and in CI. Run with
// `npm run test:visual`; refresh baselines with `npm run test:visual:update`.
// Screens use seeded catalog data, which is identical after every reseed.

test.describe('Visual regression', { tag: '@visual' }, () => {
  test.skip(
    !isRunningInPlaywrightImage(),
    'Visual baselines exist only for the Playwright Docker image; run `npm run test:visual`.',
  );

  test('login form', async ({ loginPage, page }) => {
    await loginPage.goto();

    await expect(page.getByTestId('login-form')).toHaveScreenshot('login-form.png');
  });

  test('header for a guest', async ({ productListingPage }) => {
    await productListingPage.goto();
    await expect(productListingPage.productCards.first()).toBeVisible();

    await expect(productListingPage.nav.root).toHaveScreenshot('header-guest.png');
  });

  test('product detail page', async ({ api, productDetailPage, page }) => {
    const { data } = await api.products.search('Combination Pliers');
    const product = data.find(({ name }) => name === 'Combination Pliers');
    expect(product, 'seeded product exists').toBeDefined();

    await productDetailPage.goto(product?.id ?? '');
    await expect(productDetailPage.name).toHaveText('Combination Pliers');
    await expect(page.getByRole('img', { name: 'Combination Pliers' })).toBeVisible();

    await expect(page).toHaveScreenshot('product-detail.png', {
      // Related products are picked by the API and can change order.
      mask: [page.getByRole('link').filter({ hasText: 'More information' })],
    });
  });

  test('cart with one product', async ({ api, productDetailPage, cartPage, page }) => {
    const { data } = await api.products.search('Combination Pliers');
    const product = data.find(({ name }) => name === 'Combination Pliers');
    await productDetailPage.goto(product?.id ?? '');
    await productDetailPage.addToCart();
    await expect(productDetailPage.nav.cartQuantity).toHaveText('1');

    await cartPage.goto();

    await expect(page.getByRole('table')).toHaveScreenshot('cart-table.png');
  });
});
