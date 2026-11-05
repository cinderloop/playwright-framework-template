import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { buildBrand } from '@app/data';
import { localOnly } from '@core/utils';

// A repeated DELETE should not fail differently or do more; a repeated PUT with the
// same body should leave the same state.
test.describe('Idempotency', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('deleting a cart twice answers 404 the second time', async ({ api }) => {
    const cartId = await api.carts.create();

    const first = await api.carts.deleteResponse(cartId);
    const second = await api.carts.deleteResponse(cartId);

    expect(first.status()).toBe(204);
    expect(second.status()).toBe(404);
  });

  test('deleting a brand twice answers 404 the second time', async ({ testData, adminApi }) => {
    const brand = await testData.brand();

    const first = await adminApi.brands.deleteResponse(brand.id);
    const second = await adminApi.brands.deleteResponse(brand.id);

    expect(first.status()).toBe(204);
    expect(second.status()).toBe(404);
  });

  test('deleting a product twice answers 404 the second time', async ({ testData, adminApi }) => {
    const product = await testData.product();

    const first = await adminApi.products.deleteResponse(product.id);
    const second = await adminApi.products.deleteResponse(product.id);

    expect(first.status()).toBe(204);
    expect(second.status()).toBe(404);
  });

  test('repeating a brand update leaves the same state', async ({ testData, api }) => {
    const brand = await testData.brand();
    const update = buildBrand();

    const first = await api.brands.updateResponse(brand.id, update);
    const afterFirst = await api.brands.get(brand.id);
    const second = await api.brands.updateResponse(brand.id, update);
    const afterSecond = await api.brands.get(brand.id);

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(afterFirst).toMatchObject(update);
    expect(afterSecond).toEqual(afterFirst);
  });

  test('repeating a quantity update leaves the same state', async ({ testData, api }) => {
    const product = await testData.product();
    const cartId = await api.carts.create();
    await api.carts.addItem(cartId, product.id, 1);

    await api.carts.updateQuantity(cartId, product.id, 4);
    await api.carts.updateQuantity(cartId, product.id, 4);

    const { cart_items: items } = await api.carts.get(cartId);
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(4);
  });
});
