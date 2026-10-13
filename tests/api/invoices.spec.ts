import { expect, test } from '@app/fixtures';
import { errorMessageSchema } from '@app/schemas';

test.describe('Invoices API', { tag: '@api' }, () => {
  test('listing invoices requires a token', async ({ api }) => {
    const response = await api.invoices.listResponse();

    expect(response.status()).toBe(401);
    await expect(response).toMatchSchema(errorMessageSchema);
  });

  test('a checkout creates an invoice in the customer history', async ({ testData }) => {
    // Orders cannot be deleted through the API, so this test's customer and
    // product are retained (see the `retained-data` annotation).
    const [customer, product] = await Promise.all([testData.customer(), testData.product()]);
    const { api } = customer;
    const { address } = customer.user;

    const cartId = await api.carts.create();
    await api.carts.addItem(cartId, product.id, 3);

    const invoice = await api.invoices.create({
      cart_id: cartId,
      payment_method: 'cash-on-delivery',
      payment_details: {},
      billing_street: address.street ?? '',
      billing_city: address.city ?? '',
      billing_state: address.state ?? '',
      billing_country: address.country ?? '',
      billing_postal_code: address.postal_code ?? '',
    });

    expect(invoice.user_id).toBe(customer.user.id);
    expect(invoice.total).toBeCloseTo(product.price * 3, 2);

    const history = await api.invoices.list();
    expect(history.total).toBe(1);
    expect(history.data[0]).toMatchObject({
      invoice_number: invoice.invoice_number,
      payment: { payment_method: 'cash-on-delivery' },
      invoicelines: [expect.objectContaining({ product_id: product.id, quantity: 3 })],
    });
  });

  test('a new customer starts with an empty, paginated history', async ({ testData }) => {
    const customer = await testData.customer();

    const history = await customer.api.invoices.list();

    expect(history).toMatchObject({ current_page: 1, total: 0, data: [] });
  });
});
