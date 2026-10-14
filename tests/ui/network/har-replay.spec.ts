import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@app/fixtures';
import { productPageSchema } from '@app/schemas';

// Replays the product API from a recorded HAR so the catalog renders the same
// data regardless of the backend's state. Re-record against a freshly seeded
// local Toolshop with `npm run test:har:update`.

const HAR_FILE = join(import.meta.dirname, '__hars__', 'catalog.har');
const recording = process.env.UPDATE_HAR === '1';

interface HarFile {
  log: { entries: { request: { url: string }; response: { content: { text?: string } } }[] };
}

function productsApi(apiUrl: string): RegExp {
  const origin = new URL(apiUrl).origin.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  return new RegExp(`^${origin}/products(\\?.*)?$`);
}

/** Product names in the first recorded product page. */
async function recordedProductNames(apiUrl: string): Promise<string[]> {
  const har = JSON.parse(await readFile(HAR_FILE, 'utf8')) as HarFile;
  const entry = har.log.entries.find(({ request }) => productsApi(apiUrl).test(request.url));
  const page = productPageSchema.parse(JSON.parse(entry?.response.content.text ?? 'null'));
  return page.data.map(({ name }) => name);
}

test.describe('Catalog from a recorded HAR', { tag: '@regression' }, () => {
  test.beforeEach(({ config }) => {
    test.skip(
      config.environment !== 'local',
      'The HAR holds TEST_ENV=local URLs and only matches requests to them.',
    );
  });

  test('record the product API', async ({ page, config, productListingPage }) => {
    test.skip(!recording, 'Runs only when re-recording: npm run test:har:update');
    await page.routeFromHAR(HAR_FILE, {
      url: productsApi(config.apiUrl),
      update: true,
      updateContent: 'embed',
      updateMode: 'minimal',
    });

    await productListingPage.goto();

    await expect(productListingPage.productCards).toHaveCount(9);
  });

  test('replay renders the recorded products', async ({ page, config, productListingPage }) => {
    test.skip(recording, 'Skipped while re-recording the HAR.');
    // Requests the HAR does not contain are aborted, so a passing replay
    // proves the products came from the recording and not the live API.
    await page.routeFromHAR(HAR_FILE, { url: productsApi(config.apiUrl), notFound: 'abort' });

    await productListingPage.goto();

    await expect(productListingPage.productNames).toHaveText(
      await recordedProductNames(config.apiUrl),
    );
  });
});
