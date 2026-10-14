import { buildCustomer } from '@app/data';
import { expect, test } from '@app/fixtures';
import {
  errorMessageSchema,
  invalidFields,
  loginResponseSchema,
  validationErrorSchema,
} from '@app/schemas';

test.describe('Auth API', { tag: '@api' }, () => {
  test(
    'login with valid credentials returns a bearer token',
    { tag: '@smoke' },
    async ({ api, config }) => {
      const response = await api.auth.loginResponse(config.users.customer);

      expect(response.status()).toBe(200);
      await expect(response).toMatchSchema(loginResponseSchema);
    },
  );

  test('login with unknown credentials is rejected', async ({ api, uniqueId }) => {
    // An unregistered address: wrong passwords for a real account would lock it.
    const response = await api.auth.loginResponse({
      email: `nobody-${uniqueId}@example.com`,
      password: 'not-a-password',
    });

    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  test('the current user requires a token', async ({ api }) => {
    const response = await api.auth.meResponse();

    expect(response.status()).toBe(401);
    await expect(response).toMatchSchema(errorMessageSchema);
  });

  test('the current user is the one the token belongs to', async ({ customerApi, config }) => {
    const me = await customerApi.auth.me();

    expect(me.email).toBe(config.users.customer.email);
  });

  test('a registered customer can sign in and read their profile', async ({ testData }) => {
    const customer = await testData.customer();

    const me = await customer.api.auth.me();

    expect(me).toMatchObject({
      id: customer.user.id,
      email: customer.credentials.email,
      first_name: customer.user.first_name,
    });
  });

  test('registration reports every missing required field', async ({ api }) => {
    const response = await api.auth.registerResponse({ email: '' });

    expect(response.status()).toBe(422);
    await expect(response).toMatchSchema(validationErrorSchema);
    expect(invalidFields(validationErrorSchema.parse(await response.json()))).toEqual(
      expect.arrayContaining(['email', 'first_name', 'last_name', 'password']),
    );
  });

  test('registration rejects a weak password', async ({ api }) => {
    const address = await api.addresses.lookup('US', '10001');
    const response = await api.auth.registerResponse(
      buildCustomer(address, { password: 'password' }),
    );

    expect(response.status()).toBe(422);
    expect(invalidFields(validationErrorSchema.parse(await response.json()))).toEqual(['password']);
  });
});
