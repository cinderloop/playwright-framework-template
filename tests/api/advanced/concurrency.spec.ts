import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { UNKNOWN_ID } from '@app/data';
import { localOnly, markKnownIssue } from '@core/utils';

// Parallel requests with Promise.all and fresh data per test. Nothing here depends
// on timing: each assertion must hold however the requests interleave.
test.describe('Concurrency', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('parallel quantity updates leave one of the submitted values', async ({ testData, api }) => {
    const product = await testData.product();
    const cartId = await testData.cart();
    await api.carts.addItem(cartId, product.id, 1);
    const quantities = [2, 3, 4, 5, 6];

    const responses = await Promise.all(
      quantities.map((quantity) => api.carts.updateQuantityResponse(cartId, product.id, quantity)),
    );

    expect(responses.map((response) => response.status())).toEqual(quantities.map(() => 200));
    const { cart_items: items } = await api.carts.get(cartId);
    expect(items).toHaveLength(1);
    expect(quantities).toContain(items[0]?.quantity);
  });

  test('parallel additions of the same product are all counted', async ({ testData, api }) => {
    const product = await testData.product();
    const cartId = await testData.cart();
    await api.carts.addItem(cartId, product.id, 1);

    await Promise.all([1, 2, 3, 4].map(() => api.carts.addItemResponse(cartId, product.id, 1)));

    const { cart_items: items } = await api.carts.get(cartId);
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(5);
  });

  test('parallel first additions to an empty cart keep the total', async ({ testData, api }) => {
    const product = await testData.product();
    const cartId = await testData.cart();

    await Promise.all([1, 2, 3, 4].map(() => api.carts.addItemResponse(cartId, product.id, 1)));

    const { cart_items: items } = await api.carts.get(cartId);
    const total = items.reduce((sum, item) => sum + item.quantity, 0);

    // The total always holds. The duplicate rows in F-26 depend on timing, so they
    // are not asserted: `test.fail()` needs a failure that happens every time.
    expect(total).toBe(4);
  });

  test('checking out one cart twice in parallel creates one invoice', async ({ testData }) => {
    const customer = await testData.customer();
    const input = await testData.orderInput(customer);

    const responses = await Promise.all([
      customer.api.invoices.createResponse(input),
      customer.api.invoices.createResponse(input),
    ]);
    expect(responses.map((response) => response.status())).toContain(201);
    const { total } = await customer.api.invoices.list();

    // Only the count is asserted. Both invoices sometimes get the same number, but
    // that depends on timing, and `test.fail()` needs a failure that always happens.
    markKnownIssue('F-19', 'nothing stops a cart being checked out more than once');
    expect(total).toBe(1);
  });
});

test.describe('Checkout integrity', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('a cart cannot be checked out twice', async ({ testData }) => {
    const customer = await testData.customer();
    const input = await testData.orderInput(customer);

    await customer.api.invoices.create(input);
    const second = await customer.api.invoices.createResponse(input);
    expect([201, 404, 409, 422]).toContain(second.status());

    markKnownIssue('F-19', 'a cart survives checkout and can be used again');
    expect(second.status()).not.toBe(201);
  });

  test('a failed checkout leaves no invoice behind', async ({ testData }) => {
    const customer = await testData.customer();
    const input = await testData.orderInput(customer);

    const response = await customer.api.invoices.createResponse({
      ...input,
      cart_id: UNKNOWN_ID,
    });
    expect(response.status()).toBe(404);
    const history = await customer.api.invoices.listResponse();
    const { total } = (await history.json()) as { total: number };

    markKnownIssue('F-14', 'a checkout that fails on its cart keeps an empty invoice');
    expect(total).toBe(0);
  });

  test('an empty cart cannot be checked out', async ({ testData }) => {
    const customer = await testData.customer();
    const input = await testData.orderInput(customer);
    const emptyCartId = await customer.api.carts.create();

    const response = await customer.api.invoices.createResponse({
      ...input,
      cart_id: emptyCartId,
    });
    expect([201, 422]).toContain(response.status());

    markKnownIssue('F-20', 'an empty cart checks out with a total of 0');
    expect(response.status()).toBe(422);
  });
});
