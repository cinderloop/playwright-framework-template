import { expect, test } from '@app/fixtures';
import { invalidFields, validationErrorSchema } from '@app/schemas';

test.describe('Cart API', { tag: '@api' }, () => {
  test('items can be added, updated and removed', async ({ api, testData }) => {
    const [product, cartId] = await Promise.all([testData.product(), api.carts.create()]);

    await test.step('add the product', async () => {
      await api.carts.addItem(cartId, product.id, 2);
      const cart = await api.carts.get(cartId);
      expect(cart.cart_items).toEqual([
        expect.objectContaining({ product_id: product.id, quantity: 2 }),
      ]);
    });

    await test.step('change its quantity', async () => {
      await api.carts.updateQuantity(cartId, product.id, 5);
      const [item] = (await api.carts.get(cartId)).cart_items;
      expect(item?.quantity).toBe(5);
    });

    await test.step('remove it', async () => {
      await api.carts.removeItem(cartId, product.id);
      expect((await api.carts.get(cartId)).cart_items).toEqual([]);
    });

    await api.carts.delete(cartId);
  });

  test('adding the same product twice accumulates the quantity', async ({ api, testData }) => {
    const [product, cartId] = await Promise.all([testData.product(), api.carts.create()]);

    await api.carts.addItem(cartId, product.id, 1);
    await api.carts.addItem(cartId, product.id, 2);

    const cart = await api.carts.get(cartId);
    expect(cart.cart_items).toHaveLength(1);
    expect(cart.cart_items[0]?.quantity).toBe(3);
    await api.carts.delete(cartId);
  });

  test('adding an unknown product or a zero quantity is rejected', async ({ api }) => {
    const cartId = await api.carts.create();

    const response = await api.carts.addItemResponse(cartId, '01AAAAAAAAAAAAAAAAAAAAAAAA', 0);

    expect(response.status()).toBe(422);
    expect(invalidFields(validationErrorSchema.parse(await response.json()))).toEqual([
      'product_id',
      'quantity',
    ]);
    await api.carts.delete(cartId);
  });

  test('an unknown cart returns 404', async ({ api }) => {
    const response = await api.carts.getResponse('01AAAAAAAAAAAAAAAAAAAAAAAA');

    expect(response.status()).toBe(404);
  });
});
