import { expect, test } from '@app/fixtures';
import { errorMessageSchema, invalidFields, validationErrorSchema } from '@app/schemas';

test.describe('Products API', { tag: '@api' }, () => {
  test('the catalog is paginated', { tag: '@smoke' }, async ({ api }) => {
    const firstPage = await api.products.list();

    expect(firstPage.current_page).toBe(1);
    expect(firstPage.data).toHaveLength(firstPage.per_page);
    expect(firstPage.last_page).toBe(Math.ceil(firstPage.total / firstPage.per_page));
  });

  test('pages do not overlap', async ({ api }) => {
    const [first, second] = await Promise.all([
      api.products.list({ page: 1 }),
      api.products.list({ page: 2 }),
    ]);

    expect(second.current_page).toBe(2);
    expect(second.from).toBe(first.per_page + 1);
    const firstIds = new Set(first.data.map((product) => product.id));
    expect(second.data.filter((product) => firstIds.has(product.id))).toEqual([]);
  });

  test('a page beyond the last one is empty', async ({ api }) => {
    const { last_page } = await api.products.list();

    const beyond = await api.products.list({ page: last_page + 1 });

    expect(beyond.data).toEqual([]);
    expect(beyond.from).toBeNull();
  });

  test('filtering by category and sorting by price', async ({ testData, api }) => {
    const category = await testData.category();
    for (const price of [30, 10, 20]) {
      await testData.product({ category_id: category.id, price });
    }

    const page = await api.products.list({ by_category: category.id, sort: 'price,asc' });

    expect(page.total).toBe(3);
    expect(page.data.map((product) => product.price)).toEqual([10, 20, 30]);
  });

  test('search matches product names', async ({ testData, api }) => {
    const product = await testData.product();

    const results = await api.products.search(product.name);

    expect(results.data.map((match) => match.id)).toContain(product.id);
  });

  test('a created product can be read back', async ({ testData, api }) => {
    const created = await testData.product({ price: 42.5 });

    const product = await api.products.get(created.id);

    expect(product).toMatchObject({
      id: created.id,
      name: created.name,
      price: 42.5,
      in_stock: true,
    });
  });

  test('an unknown product id returns 404', async ({ api }) => {
    const response = await api.products.getResponse('01AAAAAAAAAAAAAAAAAAAAAAAA');

    expect(response.status()).toBe(404);
    await expect(response).toMatchSchema(errorMessageSchema);
  });

  test('creating a product validates required fields', async ({ api }) => {
    const response = await api.products.createResponse({ name: '' });

    expect(response.status()).toBe(422);
    expect(invalidFields(validationErrorSchema.parse(await response.json()))).toEqual([
      'brand_id',
      'category_id',
      'is_location_offer',
      'is_rental',
      'name',
      'price',
      'product_image_id',
    ]);
  });

  test.describe('deleting a product', () => {
    test('is refused without a token', async ({ testData, api }) => {
      const product = await testData.product();

      expect((await api.products.deleteResponse(product.id)).status()).toBe(401);
    });

    test('is forbidden for customers', async ({ testData, customerApi }) => {
      const product = await testData.product();

      expect((await customerApi.products.deleteResponse(product.id)).status()).toBe(403);
    });

    test('is allowed for admins', async ({ testData, adminApi, api }) => {
      const product = await testData.product();

      expect((await adminApi.products.deleteResponse(product.id)).status()).toBe(204);
      expect((await api.products.getResponse(product.id)).status()).toBe(404);
    });
  });
});
