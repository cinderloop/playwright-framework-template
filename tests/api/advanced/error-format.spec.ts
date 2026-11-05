import { expect, test } from '@app/fixtures';
import { config } from '@app/config';
import { buildCustomer, buildProfileUpdate } from '@app/data';
import { errorResponseSchema } from '@app/schemas';
import { localOnly, markKnownIssue } from '@core/utils';

const UNUSED_ULID = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';

// Toolshop has several 4xx shapes, so the contract is a family of them
// (`errorResponseSchema`), not one schema. An unknown shape fails here.
test.describe('Error format', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);

  test('401', async ({ api }) => {
    const response = await api.auth.meResponse();

    expect(response.status()).toBe(401);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('401 from a failed login', async ({ api, uniqueId }) => {
    const response = await api.auth.loginResponse({
      email: `nobody.${uniqueId}@example.com`,
      password: 'wrong-password',
    });

    expect(response.status()).toBe(401);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('403', async ({ testData }) => {
    const { api } = await testData.customer();

    const response = await api.users.listResponse();

    expect(response.status()).toBe(403);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('404 for an unknown route', async ({ api }) => {
    const response = await api.raw.response('GET', '/no-such-route');

    expect(response.status()).toBe(404);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('404 for an unknown resource', async ({ api }) => {
    const response = await api.products.getResponse(UNUSED_ULID);

    expect(response.status()).toBe(404);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('405', async ({ api }) => {
    const response = await api.raw.response('PATCH', '/carts');

    expect(response.status()).toBe(405);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('409', async ({ testData, api }) => {
    const { user, input } = await testData.registered();

    const response = await api.auth.registerResponse({ ...input, email: user.email });

    expect(response.status()).toBe(409);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('422 as a field map', async ({ api }) => {
    const response = await api.brands.createResponse({});

    expect(response.status()).toBe(422);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test('422 as a message and errors', async ({ api }) => {
    const cartId = await api.carts.create();

    const response = await api.carts.addItemResponse(cartId, UNUSED_ULID, 1);

    expect(response.status()).toBe(422);
    await expect(response).toMatchSchema(errorResponseSchema);
  });

  test.describe('internal details', () => {
    test('a 500 does not include a stack trace', async ({ testData }) => {
      const customer = await testData.customer();
      const input = await testData.orderInput(customer);

      const response = await customer.api.invoices.createResponse({
        ...input,
        payment_details: 'not-an-object' as unknown as Record<string, string>,
      });
      expect(response.status()).toBe(500);
      const body = await response.text();

      markKnownIssue('F-17', 'a 500 returns the exception, file paths and a stack trace');
      expect(body).not.toContain('"trace"');
    });

    test('a duplicate email does not return SQL', async ({ testData }) => {
      const [customer, other] = await Promise.all([testData.customer(), testData.customer()]);

      const response = await customer.api.users.updateResponse(customer.user.id, {
        ...buildProfileUpdate(customer.user),
        email: other.user.email,
      });
      expect(response.status()).toBe(403);
      const body = await response.text();

      markKnownIssue('F-17', 'a duplicate email returns the raw SQL error');
      expect(body).not.toContain('SQLSTATE');
    });
  });

  test('422 from registration', async ({ api }) => {
    const address = await api.addresses.lookup('US', '10001');

    const response = await api.auth.registerResponse({
      ...buildCustomer(address),
      dob: 'not-a-date',
    });

    expect(response.status()).toBe(422);
    await expect(response).toMatchSchema(errorResponseSchema);
  });
});
