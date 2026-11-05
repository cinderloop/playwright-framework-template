import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { buildMessage, buildProfileUpdate } from '@app/data';
import { localOnly, markKnownIssue } from '@core/utils';

const UNUSED_ULID = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';

// Each test sends fields a client should not control, then checks the result by
// reading the resource back: a 2xx alone says nothing about what was stored.
test.describe('Mass assignment', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test.describe('registration', () => {
    test('cannot grant the admin role', async ({ testData, adminApi }) => {
      const customer = await testData.customer({ role: 'admin' });

      const stored = await adminApi.users.get(customer.user.id);
      expect(stored.role).toBe('user');

      const adminOnly = await customer.api.users.listResponse();
      expect(adminOnly.status()).toBe(403);
    });

    test('ignores a client-chosen id', async ({ testData }) => {
      const { user } = await testData.registered({ id: UNUSED_ULID });

      expect(user.id).not.toBe(UNUSED_ULID);
    });

    test('cannot set account state', async ({ testData, adminApi }) => {
      const { user } = await testData.registered({ enabled: false, failed_login_attempts: 2 });
      const stored = await adminApi.users.get(user.id);

      markKnownIssue('F-09', 'registration stores enabled and failed_login_attempts');
      expect(stored).toMatchObject({ enabled: true, failed_login_attempts: 0 });
    });
  });

  test.describe('profile updates', () => {
    test('PATCH cannot grant the admin role', async ({ testData, adminApi }) => {
      const customer = await testData.customer();

      await customer.api.users.patchResponse(customer.user.id, { role: 'admin' });

      const stored = await adminApi.users.get(customer.user.id);
      expect(stored.role).toBe('user');
      const adminOnly = await customer.api.users.listResponse();
      expect(adminOnly.status()).toBe(403);
    });

    test('PUT cannot grant the admin role', async ({ testData, adminApi }) => {
      const customer = await testData.customer();

      const response = await customer.api.users.updateResponse(customer.user.id, {
        ...buildProfileUpdate(customer.user),
        role: 'admin',
      });

      expect(response.status()).toBe(403);
      const stored = await adminApi.users.get(customer.user.id);
      expect(stored.role).toBe('user');
    });

    test('PUT cannot change the password', async ({ testData, api }) => {
      const customer = await testData.customer();

      const response = await customer.api.users.updateResponse(customer.user.id, {
        ...buildProfileUpdate(customer.user),
        password: `${customer.credentials.password}x`,
      });

      expect(response.status()).toBe(200);
      const login = await api.auth.loginResponse(customer.credentials);
      expect(login.status()).toBe(200);
    });

    test('PATCH cannot change the failed login count', async ({ testData, adminApi }) => {
      const customer = await testData.customer();

      const response = await customer.api.users.patchResponse(customer.user.id, {
        failed_login_attempts: 2,
      });
      expect(response.status()).toBe(200);
      const stored = await adminApi.users.get(customer.user.id);

      markKnownIssue('F-09', 'a customer can write their own failed_login_attempts');
      expect(stored.failed_login_attempts).toBe(0);
    });

    test('PUT cannot turn on two-factor login', async ({ testData, adminApi }) => {
      const customer = await testData.customer();

      const response = await customer.api.users.updateResponse(customer.user.id, {
        ...buildProfileUpdate(customer.user),
        totp_enabled: true,
      });
      expect(response.status()).toBe(200);
      const stored = await adminApi.users.get(customer.user.id);

      markKnownIssue('F-09', 'a customer can write totp fields without verifying a code');
      expect(stored.totp_enabled).toBe(false);
    });
  });

  test.describe('invoices', () => {
    test('checkout ignores forged totals and ownership', async ({ testData }) => {
      const [customer, other] = await Promise.all([testData.customer(), testData.customer()]);

      const { invoice } = await testData.order(customer, {
        total: 0.5,
        subtotal: 0.5,
        invoice_number: 'INV-1',
        user_id: other.user.id,
      });

      expect(invoice.user_id).toBe(customer.user.id);
      expect(invoice.total).toBeGreaterThan(0.5);
      expect(invoice.invoice_number).not.toBe('INV-1');
    });

    test('PATCH ignores a forged total', async ({ testData }) => {
      const customer = await testData.customer();
      const { invoice } = await testData.order(customer);

      await customer.api.invoices.patchResponse(invoice.id, { total: 0.5 });

      const stored = await customer.api.invoices.get(invoice.id);
      expect(stored.total).toBe(invoice.total);
    });

    test('PUT ignores a forged total', async ({ testData }) => {
      const customer = await testData.customer();
      const { invoice, input } = await testData.order(customer);

      const response = await customer.api.invoices.updateResponse(invoice.id, {
        ...input,
        total: 0.5,
      });
      expect(response.status()).toBe(200);
      const stored = await customer.api.invoices.get(invoice.id);

      markKnownIssue('F-04', 'an owner can set the total of their invoice');
      expect(stored.total).toBe(invoice.total);
    });

    test('PUT cannot hand an invoice to another customer', async ({ testData }) => {
      const [customer, other] = await Promise.all([testData.customer(), testData.customer()]);
      const { invoice, input } = await testData.order(customer);

      const response = await customer.api.invoices.updateResponse(invoice.id, {
        ...input,
        user_id: other.user.id,
      });
      expect(response.status()).toBe(200);
      const readByOther = await other.api.invoices.getResponse(invoice.id);

      markKnownIssue('F-04', 'an owner can reassign their invoice to another customer');
      expect(readByOther.status()).toBe(404);
    });

    test('a status update writes nothing but the status', async ({ testData, adminApi }) => {
      const customer = await testData.customer();
      const { invoice } = await testData.order(customer);

      const response = await adminApi.invoices.updateStatusResponse(invoice.id, 'SHIPPED', {
        total: 0.5,
      });
      expect(response.status()).toBe(200);
      const stored = await customer.api.invoices.get(invoice.id);

      markKnownIssue('F-03', 'the status endpoint writes any column in the request');
      expect(stored.total).toBe(invoice.total);
    });
  });

  test('a favorite always belongs to the caller', async ({ testData, api }) => {
    const [customer, other] = await Promise.all([testData.customer(), testData.customer()]);
    const { data } = await api.products.list();
    const productId = data[0]?.id ?? '';

    const favorite = await customer.api.favorites.create(productId, { user_id: other.user.id });

    expect(favorite.user_id).toBe(customer.user.id);
  });

  test('an anonymous message cannot claim to be from a customer', async ({ testData, api }) => {
    const customer = await testData.customer();

    const message = await api.messages.create({ ...buildMessage(), user_id: customer.user.id });

    markKnownIssue('F-12', 'an anonymous sender can attribute a message to any user_id');
    expect(message.user_id ?? null).toBeNull();
  });
});
