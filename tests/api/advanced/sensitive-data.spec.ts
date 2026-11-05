import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { buildCustomer } from '@app/data';
import { userSchema } from '@app/schemas';
import { localOnly, markKnownIssue } from '@core/utils';

/** Must never leave the server, for any caller. */
const SECRETS = ['password', 'remember_token', 'totp_secret', 'totp_verified_at', 'uid'];
/** Shown to admins by design, so hidden from customers only. */
const ADMIN_ONLY = ['role', 'enabled', 'failed_login_attempts'];
const CUSTOMER_HIDDEN = [...SECRETS, ...ADMIN_ONLY];
const CARD_DATA = ['credit_card_number', 'cvv'];

// Always check the raw response. The typed clients parse bodies through Zod, which
// strips unknown keys, so a leaked field would be gone before the matcher saw it.

test.describe('Sensitive data exposure', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('registration returns no secrets', async ({ api, adminApi }) => {
    const address = await api.addresses.lookup('US', '10001');

    const response = await api.auth.registerResponse(buildCustomer(address));

    expect(response.status()).toBe(201);
    const { id } = userSchema.parse(await response.json());
    await adminApi.users.deleteResponse(id);
    await expect(response).toNotExposeFields(CUSTOMER_HIDDEN);
  });

  test('login returns only the token details', async ({ testData, api }) => {
    const { credentials } = await testData.customer();

    const response = await api.auth.loginResponse(credentials);

    await expect(response).toNotExposeFields(CUSTOMER_HIDDEN);
  });

  test('the current user sees no secrets', async ({ testData }) => {
    const { api } = await testData.customer();

    await expect(await api.auth.meResponse()).toNotExposeFields(CUSTOMER_HIDDEN);
  });

  test('a user reading themselves sees no secrets', async ({ testData }) => {
    const { api, user } = await testData.customer();

    await expect(await api.users.getResponse(user.id)).toNotExposeFields(CUSTOMER_HIDDEN);
  });

  test('admins see no secrets on a user', async ({ testData, adminApi }) => {
    const { user } = await testData.customer();

    await expect(await adminApi.users.getResponse(user.id)).toNotExposeFields(SECRETS);
  });

  test('admin user lists show no secrets', async ({ adminApi }) => {
    await expect(await adminApi.users.listResponse()).toNotExposeFields(SECRETS);
    await expect(await adminApi.users.searchResponse('a')).toNotExposeFields(SECRETS);
  });

  test.describe('card details', () => {
    const creditCard = {
      payment_method: 'credit-card' as const,
      payment_details: {
        credit_card_number: '4111-1111-1111-1111',
        expiration_date: '12/2030',
        cvv: '123',
        card_holder_name: 'Test Customer',
      },
    };

    test('are not in the checkout response', async ({ testData }) => {
      const customer = await testData.customer();

      const input = await testData.orderInput(customer, creditCard);

      const response = await customer.api.invoices.createResponse(input);

      expect(response.status()).toBe(201);
      await expect(response).toNotExposeFields(CARD_DATA);
    });

    test('are not in the invoice list', async ({ testData }) => {
      const customer = await testData.customer();
      await testData.order(customer, creditCard);

      await expect(await customer.api.invoices.listResponse()).toNotExposeFields(CARD_DATA);
    });

    test('are not in a single invoice', async ({ testData }) => {
      const customer = await testData.customer();
      const { invoice } = await testData.order(customer, creditCard);

      const response = await customer.api.invoices.getResponse(invoice.id);
      expect(response.status()).toBe(200);

      markKnownIssue('F-06', 'GET /invoices/{id} returns the full card number and CVV');
      await expect(response).toNotExposeFields(CARD_DATA);
    });
  });
});
