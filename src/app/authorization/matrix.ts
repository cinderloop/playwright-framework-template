import type { APIResponse } from '@playwright/test';
import { expect } from '@core/fixtures';
import { buildMatrix, expandEntry, type KnownIssue, type MatrixEntry } from '@core/authorization';
import { reportNames, type ToolshopApi } from '@app/api';
import { buildProfileUpdate, type NewCustomer } from '@app/data';
import { graphqlResponseSchema } from '@app/schemas';
import type { ToolshopActor, ToolshopAuthorizationContext } from './context';

/**
 * Who may do what in Toolshop, stated as the correct behaviour. Where Toolshop
 * falls short a row records a `knownIssue`; docs/api-findings.md has the details.
 *
 * Left out on purpose:
 * - Carts: they have no owner, so there is nothing to cross.
 * - Catalogue POST, PUT and PATCH: unauthenticated by design (F-07).
 */

type Entry<TResource> = MatrixEntry<
  ToolshopActor,
  ToolshopApi,
  ToolshopAuthorizationContext,
  TResource
>;

function row<TResource>(entry: Entry<TResource>) {
  return expandEntry(entry);
}

/** Both are correct for cross-user access; see ADR 0009. */
const DENIED = [403, 404] as const;

function issue(finding: string, description: string, observedStatus = 200): KnownIssue {
  return { finding, description, observedStatus };
}

async function profileUnchanged({ resource: owner }: { resource: NewCustomer }): Promise<void> {
  const profile = await owner.api.auth.me();
  expect(profile.first_name).toBe(owner.user.first_name);
  expect(profile.address.street).toBe(owner.user.address.street);
}

/**
 * The body must not mention the resource, whatever the status. It compares a boolean
 * so that a real leak does not print someone else's data into the report.
 */
async function expectNotRevealed(response: APIResponse, id: string): Promise<void> {
  const revealed = (await response.text()).includes(id);
  expect(revealed, `The response reveals ${id}`).toBe(false);
}

/** The request was refused: an error, and no data for the requested field. */
function graphqlDenied(field: string, knownIssue?: KnownIssue) {
  return {
    status: 200,
    label: 'denied',
    ...(knownIssue ? { knownIssue } : {}),
    verify: async ({ response }: { response: APIResponse }) => {
      const { data, errors } = graphqlResponseSchema.parse(await response.json());
      expect(errors, 'GraphQL returned no error').toBeDefined();
      expect(data?.[field] ?? null, 'GraphQL returned data').toBeNull();
    },
  };
}

function graphqlAllowed(field: string) {
  return {
    status: 200,
    label: 'allowed',
    verify: async ({ response }: { response: APIResponse }) => {
      const { data, errors } = graphqlResponseSchema.parse(await response.json());
      expect(errors).toBeUndefined();
      expect(data?.[field]).toBeTruthy();
    },
  };
}

const users = [
  row({
    name: 'GET /users/{id}',
    arrange: (context) => context.owner(),
    request: (client, owner) => client.users.getResponse(owner.user.id),
    expectations: { anonymous: 401, owner: 200, 'other-user': DENIED, admin: 200 },
  }),
  // Addresses have no endpoints of their own, so these rows cover them too.
  row({
    name: 'PUT /users/{id}',
    arrange: (context) => context.owner(),
    request: (client, owner) =>
      client.users.updateResponse(owner.user.id, buildProfileUpdate(owner.user)),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': { status: DENIED, verify: profileUnchanged },
      admin: 200,
    },
  }),
  row({
    name: 'PATCH /users/{id}',
    arrange: (context) => context.owner(),
    request: (client, owner) =>
      client.users.patchResponse(owner.user.id, buildProfileUpdate(owner.user)),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': { status: DENIED, verify: profileUnchanged },
      admin: 200,
    },
  }),
  row({
    name: 'DELETE /users/{id}',
    arrange: (context) => context.owner(),
    request: (client, owner) => client.users.deleteResponse(owner.user.id),
    expectations: { anonymous: 401, owner: 403, 'other-user': 403, admin: 204 },
  }),
  row({
    name: 'GET /users',
    arrange: () => Promise.resolve(),
    request: (client) => client.users.listResponse(),
    expectations: { anonymous: 401, customer: 403, admin: 200 },
  }),
  row({
    name: 'GET /users/search',
    arrange: () => Promise.resolve(),
    request: (client) => client.users.searchResponse('a'),
    expectations: {
      anonymous: 401,
      customer: {
        status: 403,
        knownIssue: issue('F-10', 'any customer can search every customer'),
      },
      admin: 200,
    },
  }),
];

const invoices = [
  row({
    name: 'GET /invoices/{id}',
    arrange: (context) => context.invoice(),
    request: (client, { id }) => client.invoices.getResponse(id),
    expectations: { anonymous: 401, owner: 200, 'other-user': DENIED, admin: 200 },
  }),
  row({
    name: 'PUT /invoices/{id}',
    arrange: (context) => context.invoice(),
    request: (client, { id, input }) => client.invoices.updateResponse(id, input),
    expectations: { anonymous: 401, owner: 200, 'other-user': DENIED },
  }),
  row({
    name: 'PATCH /invoices/{id}',
    arrange: (context) => context.invoice(),
    request: (client, { id }) =>
      client.invoices.patchResponse(id, { billing_street: 'Changed Street' }),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': {
        status: DENIED,
        verify: async ({ resource: { owner, id, input } }) => {
          const invoice = await owner.api.invoices.get(id);
          expect(invoice.billing_street).toBe(input.billing_street);
        },
      },
    },
  }),
  row({
    name: 'PUT /invoices/{id}/status',
    arrange: (context) => context.invoice(),
    request: (client, { id }) => client.invoices.updateStatusResponse(id, 'SHIPPED'),
    expectations: {
      anonymous: 401,
      owner: {
        status: 403,
        knownIssue: issue('F-03', 'a customer can change the status of their own invoice'),
      },
      'other-user': {
        status: DENIED,
        knownIssue: issue('F-03', "a customer can change the status of anyone's invoice"),
      },
      admin: 200,
    },
  }),
  row({
    name: 'GET /invoices/{number}/download-pdf',
    arrange: (context) => context.invoiceWithPdf(),
    request: (client, { invoiceNumber }) => client.invoices.pdfResponse(invoiceNumber),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': {
        status: DENIED,
        knownIssue: issue('F-08', "any customer can download anyone's invoice PDF"),
      },
      admin: 200,
    },
  }),
  row({
    name: 'GET /invoices/{number}/download-pdf-status',
    arrange: (context) => context.invoiceWithPdf(),
    request: (client, { invoiceNumber }) => client.invoices.pdfStatusResponse(invoiceNumber),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': {
        status: DENIED,
        knownIssue: issue('F-08', "any customer can read the PDF status of anyone's invoice"),
      },
      admin: 200,
    },
  }),
  row({
    name: 'GET /invoices',
    arrange: (context) => context.invoice(),
    request: (client) => client.invoices.listResponse(),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': {
        status: 200,
        verify: ({ resource, response }) => expectNotRevealed(response, resource.id),
      },
    },
  }),
  row({
    name: 'GET /invoices/search',
    arrange: (context) => context.invoice(),
    request: (client, { invoiceNumber }) => client.invoices.searchResponse(invoiceNumber),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': {
        status: 200,
        verify: ({ resource, response }) => expectNotRevealed(response, resource.id),
      },
    },
  }),
];

const favorites = [
  row({
    name: 'GET /favorites/{id}',
    arrange: (context) => context.favorite(),
    request: (client, { favorite }) => client.favorites.getResponse(favorite.id),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': {
        status: DENIED,
        knownIssue: issue('F-11', "any customer can read another customer's favorite"),
      },
    },
  }),
  row({
    name: 'DELETE /favorites/{id}',
    arrange: (context) => context.favorite(),
    request: (client, { favorite }) => client.favorites.deleteResponse(favorite.id),
    expectations: {
      anonymous: 401,
      owner: 204,
      // Toolshop answers 204 but deletes nothing (F-18): misleading, not a breach.
      'other-user': {
        status: [204, ...DENIED],
        verify: async ({ resource: { owner, favorite } }) => {
          const response = await owner.api.favorites.getResponse(favorite.id);
          expect(response.status()).toBe(200);
        },
      },
    },
  }),
  row({
    name: 'GET /favorites',
    arrange: (context) => context.favorite(),
    request: (client) => client.favorites.listResponse(),
    expectations: {
      anonymous: 401,
      owner: 200,
      'other-user': {
        status: 200,
        verify: ({ resource, response }) => expectNotRevealed(response, resource.favorite.id),
      },
    },
  }),
];

const messages = [
  row({
    name: 'GET /messages/{id}',
    arrange: (context) => context.message(),
    request: (client, { message }) => client.messages.getResponse(message.id),
    expectations: {
      anonymous: 401,
      owner: 200,
      // Toolshop answers `200 []` (F-18): wrong, but it reveals nothing.
      'other-user': {
        status: [200, ...DENIED],
        verify: ({ resource, response }) => expectNotRevealed(response, resource.message.id),
      },
      admin: 200,
    },
  }),
  row({
    name: 'POST /messages/{id}/reply',
    arrange: (context) => context.message(),
    request: (client, { message }) => client.messages.replyResponse(message.id, 'A reply'),
    expectations: {
      anonymous: 401,
      owner: 201,
      'other-user': {
        status: DENIED,
        knownIssue: issue('F-12', "any customer can reply to anyone's message", 201),
      },
      admin: 201,
    },
  }),
  row({
    name: 'PUT /messages/{id}/status',
    arrange: (context) => context.message(),
    request: (client, { message }) => client.messages.updateStatusResponse(message.id, 'RESOLVED'),
    expectations: {
      anonymous: 401,
      owner: {
        status: 403,
        knownIssue: issue('F-12', 'a customer can resolve their own message'),
      },
      'other-user': {
        status: DENIED,
        knownIssue: issue('F-12', "any customer can change the status of anyone's message"),
      },
      admin: 200,
    },
  }),
];

const spec = { spec_name: 'Weight', spec_value: '2', spec_unit: 'kg' };

async function productWithSpec(context: ToolshopAuthorizationContext) {
  const product = await context.testData.product();
  const created = await context.adminApi.productSpecs.create(product.id, spec);
  return { productId: product.id, specId: created.id };
}

const productSpecs = [
  row({
    name: 'POST /products/{id}/specs',
    arrange: (context) => context.testData.product(),
    request: (client, product) => client.productSpecs.createResponse(product.id, spec),
    expectations: {
      anonymous: 401,
      customer: {
        status: 403,
        knownIssue: issue('F-13', 'any customer can add product specs', 201),
      },
      admin: 201,
    },
  }),
  row({
    name: 'PUT /products/{id}/specs/{specId}',
    arrange: productWithSpec,
    request: (client, { productId, specId }) =>
      client.productSpecs.updateResponse(productId, specId, { spec_value: '3' }),
    expectations: {
      anonymous: 401,
      customer: { status: 403, knownIssue: issue('F-13', 'any customer can change product specs') },
      admin: 200,
    },
  }),
  row({
    name: 'DELETE /products/{id}/specs/{specId}',
    arrange: productWithSpec,
    request: (client, { productId, specId }) =>
      client.productSpecs.deleteResponse(productId, specId),
    expectations: {
      anonymous: 401,
      customer: {
        status: 403,
        knownIssue: issue('F-13', 'any customer can delete product specs', 204),
      },
      admin: 204,
    },
  }),
];

const adminOnlyDeletes = { anonymous: 401, customer: 403, admin: 204 };

const catalogue = [
  row({
    name: 'DELETE /products/{id}',
    arrange: (context) => context.testData.product(),
    request: (client, product) => client.products.deleteResponse(product.id),
    expectations: adminOnlyDeletes,
  }),
  row({
    name: 'DELETE /brands/{id}',
    arrange: (context) => context.testData.brand(),
    request: (client, brand) => client.brands.deleteResponse(brand.id),
    expectations: adminOnlyDeletes,
  }),
  row({
    name: 'DELETE /categories/{id}',
    arrange: (context) => context.testData.category(),
    request: (client, category) => client.categories.deleteResponse(category.id),
    expectations: adminOnlyDeletes,
  }),
];

const reports = reportNames.map((report) =>
  row({
    name: `GET /reports/${report}`,
    arrange: () => Promise.resolve(),
    request: (client) => client.reports.getResponse(report),
    expectations: { anonymous: 401, customer: 403, admin: 200 },
  }),
);

/** The same rules as REST, because this is a second route to the same data (F-05). */
const graphql = [
  row({
    name: 'GraphQL users',
    arrange: () => Promise.resolve(),
    request: (client) => client.graphql.queryResponse('{ users(first: 5) { data { id email } } }'),
    expectations: {
      anonymous: graphqlDenied('users'),
      customer: graphqlDenied(
        'users',
        issue('F-05', 'any customer can list every account, admins included'),
      ),
      admin: graphqlAllowed('users'),
    },
  }),
  row({
    name: 'GraphQL user(id)',
    arrange: (context) => context.owner(),
    request: (client, owner) =>
      client.graphql.queryResponse('query ($id: ID!) { user(id: $id) { id email } }', {
        id: owner.user.id,
      }),
    expectations: {
      anonymous: graphqlDenied('user'),
      owner: graphqlAllowed('user'),
      'other-user': graphqlDenied(
        'user',
        issue('F-05', "any customer can read another customer's profile"),
      ),
      admin: graphqlAllowed('user'),
    },
  }),
  row({
    name: 'GraphQL invoice(id)',
    arrange: (context) => context.invoice(),
    request: (client, { id }) =>
      client.graphql.queryResponse('query ($id: ID!) { invoice(id: $id) { id total } }', { id }),
    expectations: {
      anonymous: graphqlDenied('invoice'),
      owner: graphqlAllowed('invoice'),
      'other-user': graphqlDenied(
        'invoice',
        issue('F-05', "any customer can read another customer's invoice"),
      ),
      admin: graphqlAllowed('invoice'),
    },
  }),
  row({
    name: 'GraphQL deleteProduct',
    arrange: (context) => context.testData.product(),
    request: (client, product) =>
      client.graphql.queryResponse('mutation ($id: ID!) { deleteProduct(id: $id) { id } }', {
        id: product.id,
      }),
    expectations: {
      anonymous: graphqlDenied('deleteProduct'),
      customer: graphqlDenied(
        'deleteProduct',
        issue('F-05', 'any customer can delete a product, which REST reserves for admins'),
      ),
      admin: graphqlAllowed('deleteProduct'),
    },
  }),
];

export const authorizationMatrix = buildMatrix(
  ...users,
  ...invoices,
  ...favorites,
  ...messages,
  ...productSpecs,
  ...catalogue,
  ...reports,
  ...graphql,
);
