import { endpoint, holdRequests } from '@core/utils';
import { expect, test } from '@app/fixtures';
import type { ProductPage } from '@app/schemas';

// These tests replace Toolshop API responses with page.route to reach states
// a healthy backend never produces on demand.

const emptyPage: ProductPage = {
  current_page: 1,
  data: [],
  from: null,
  to: null,
  last_page: 1,
  per_page: 9,
  total: 0,
};

test.describe('Product listing under API failures', { tag: '@regression' }, () => {
  test('an empty catalog shows the empty state', async ({ page, config, productListingPage }) => {
    await page.route(endpoint(config.apiUrl, '/products'), (route) =>
      route.fulfill({ json: emptyPage }),
    );

    await productListingPage.goto();

    await expect(productListingPage.noResults).toHaveText('There are no products found.');
    await expect(productListingPage.productCards).toHaveCount(0);
  });

  test('a slow product API keeps the grid loading, not empty', async ({
    page,
    config,
    productListingPage,
  }) => {
    const products = await holdRequests(page, endpoint(config.apiUrl, '/products'));

    await productListingPage.goto();
    await products.intercepted;

    await test.step('while the response is pending', async () => {
      await expect(productListingPage.nav.root).toBeVisible();
      await expect(productListingPage.productCards).toHaveCount(0);
      await expect(productListingPage.noResults).toBeHidden();
    });

    products.release();
    await expect(productListingPage.productCards.first()).toBeVisible();
  });

  test('a failing product API shows no products and no empty state', async ({
    page,
    config,
    productListingPage,
  }, testInfo) => {
    await page.route(endpoint(config.apiUrl, '/products'), (route) =>
      route.fulfill({ status: 500, json: { message: 'Server Error' } }),
    );
    const failed = page.waitForResponse((response) => response.status() === 500);

    await productListingPage.goto();
    await failed;

    // Characterises current behaviour: Toolshop shows no error message here.
    testInfo.annotations.push({
      type: 'ux-gap',
      description: 'A 500 from GET /products leaves the loading grid with no error message.',
    });
    await expect(productListingPage.productCards).toHaveCount(0);
    await expect(productListingPage.noResults).toBeHidden();
    await expect(productListingPage.nav.root).toBeVisible();
  });
});

test.describe('Cart under API failures', { tag: '@regression' }, () => {
  test('a failing add-to-cart shows the server error and leaves the cart empty', async ({
    page,
    config,
    testData,
    productDetailPage,
  }) => {
    const product = await testData.product();
    const { origin } = new URL(config.apiUrl);
    await page.route(
      (url) => url.origin === origin && url.pathname.startsWith('/carts'),
      (route) =>
        route.request().method() === 'POST'
          ? route.fulfill({ status: 500, json: { message: 'Cart service unavailable' } })
          : route.fallback(),
    );

    await productDetailPage.goto(product.id);
    await productDetailPage.addToCart();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Cart service unavailable' }),
    ).toBeVisible();
    await expect(productDetailPage.addedToCartToast).toBeHidden();
    await expect(productDetailPage.nav.cartQuantity).toHaveCount(0);
  });
});
