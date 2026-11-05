import type { z } from 'zod';
import type { HttpMethod } from '@core/api';
import type { ToolshopApi } from '@app/api';
import {
  buildBrand,
  buildCategory,
  buildCustomer,
  buildMessage,
  buildProduct,
  type NewCustomer,
} from '@app/data';
import {
  brandListSchema,
  brandSchema,
  cartSchema,
  cartUpdateResultSchema,
  categoryListSchema,
  categoryTreeSchema,
  createdCartSchema,
  createdCategorySchema,
  createdInvoiceSchema,
  errorResponseSchema,
  favoriteSchema,
  invoicePageSchema,
  invoiceSchema,
  loginResponseSchema,
  messageSchema,
  postcodeLookupSchema,
  productImageListSchema,
  productPageSchema,
  productSchema,
  productSpecSchema,
  userSchema,
  type InvoiceInput,
  type PostcodeLookup,
  type Product,
} from '@app/schemas';

/** Real data the operations below refer to, created once per run. */
export interface ContractSamples {
  customer: NewCustomer;
  product: Product;
  address: PostcodeLookup;
  imageId: string;
  brandId: string;
  categoryId: string;
  cartId: string;
  invoiceId: string;
  invoiceInput: InvoiceInput;
  favoriteId: string;
  messageId: string;
  secondProductId: string;
}

export interface ContractClients {
  anonymous: ToolshopApi;
  customer: ToolshopApi;
  admin: ToolshopApi;
}

export interface CoveredOperation {
  method: HttpMethod;
  /** Exactly as the spec writes it, including its parameter names. */
  path: string;
  /** Why this sample exists, when it is not the plain success case. */
  scenario?: string;
  as?: keyof ContractClients;
  values?: (samples: ContractSamples) => Record<string, string>;
  query?: Record<string, string | number>;
  data?: (samples: ContractSamples) => unknown;
  /** The framework's schema for this response. A mismatch fails the check. */
  schema?: z.ZodType;
  /** Removes what the request created. */
  undo?: (clients: ContractClients, id: string) => Promise<unknown>;
}

const UNUSED_ULID = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';

/** Every operation the framework's clients and schemas rely on. */
export const coveredOperations: readonly CoveredOperation[] = [
  // Catalogue
  { method: 'GET', path: '/products', schema: productPageSchema },
  { method: 'GET', path: '/products/search', query: { q: 'pliers' }, schema: productPageSchema },
  {
    method: 'GET',
    path: '/products/{productId}',
    values: ({ product }) => ({ productId: product.id }),
    schema: productSchema,
  },
  {
    method: 'GET',
    path: '/products/{productId}',
    scenario: 'unknown id',
    values: () => ({ productId: UNUSED_ULID }),
    schema: errorResponseSchema,
  },
  {
    method: 'POST',
    path: '/products',
    data: ({ imageId, brandId, categoryId }) =>
      buildProduct({ product_image_id: imageId, brand_id: brandId, category_id: categoryId }),
    schema: productSchema,
    undo: ({ admin }, id) => admin.products.deleteResponse(id),
  },
  { method: 'GET', path: '/images', schema: productImageListSchema },
  { method: 'GET', path: '/brands', schema: brandListSchema },
  {
    method: 'GET',
    path: '/brands/{brandId}',
    values: ({ brandId }) => ({ brandId }),
    schema: brandSchema,
  },
  {
    method: 'POST',
    path: '/brands',
    data: () => buildBrand(),
    schema: brandSchema,
    undo: ({ admin }, id) => admin.brands.deleteResponse(id),
  },
  {
    method: 'POST',
    path: '/brands',
    scenario: 'invalid body',
    data: () => ({}),
    schema: errorResponseSchema,
  },
  { method: 'GET', path: '/categories', schema: categoryListSchema },
  { method: 'GET', path: '/categories/tree', schema: categoryTreeSchema },
  {
    method: 'POST',
    path: '/categories',
    data: () => buildCategory(),
    schema: createdCategorySchema,
    undo: ({ admin }, id) => admin.categories.deleteResponse(id),
  },

  // Carts
  {
    method: 'POST',
    path: '/carts',
    schema: createdCartSchema,
    undo: ({ anonymous }, id) => anonymous.carts.delete(id),
  },
  {
    method: 'GET',
    path: '/carts/{cartId}',
    values: ({ cartId }) => ({ cartId }),
    schema: cartSchema,
  },
  {
    method: 'POST',
    path: '/carts/{id}',
    values: ({ cartId }) => ({ id: cartId }),
    data: ({ product }) => ({ product_id: product.id, quantity: 1 }),
    schema: cartUpdateResultSchema,
  },
  {
    method: 'POST',
    path: '/carts/{id}',
    scenario: 'invalid body',
    values: ({ cartId }) => ({ id: cartId }),
    data: () => ({}),
    schema: errorResponseSchema,
  },
  {
    method: 'PUT',
    path: '/carts/{cartId}/product/quantity',
    values: ({ cartId }) => ({ cartId }),
    data: ({ product }) => ({ product_id: product.id, quantity: 2 }),
    schema: cartUpdateResultSchema,
  },

  // Accounts
  {
    method: 'POST',
    path: '/users/login',
    data: ({ customer }) => customer.credentials,
    schema: loginResponseSchema,
  },
  {
    method: 'POST',
    path: '/users/login',
    scenario: 'wrong password',
    // An unknown email, so this cannot count towards a lockout.
    data: () => ({ email: 'nobody@example.com', password: 'wrong-password' }),
    schema: errorResponseSchema,
  },
  {
    method: 'POST',
    path: '/users/register',
    data: ({ address }) => buildCustomer(address),
    schema: userSchema,
    undo: ({ admin }, id) => admin.users.deleteResponse(id),
  },
  {
    method: 'POST',
    path: '/users/register',
    scenario: 'duplicate email',
    data: ({ address, customer }) => ({
      ...buildCustomer(address),
      email: customer.user.email,
    }),
    schema: errorResponseSchema,
  },
  {
    method: 'POST',
    path: '/users/forgot-password',
    scenario: 'unknown email',
    data: () => ({ email: 'nobody@example.com' }),
    schema: errorResponseSchema,
  },
  { method: 'GET', path: '/users/me', as: 'customer', schema: userSchema },
  { method: 'GET', path: '/users/me', scenario: 'no token', schema: errorResponseSchema },
  {
    method: 'GET',
    path: '/users/{userId}',
    as: 'admin',
    values: ({ customer }) => ({ userId: customer.user.id }),
    schema: userSchema,
  },
  {
    method: 'DELETE',
    path: '/users/{userId}',
    scenario: 'unknown id',
    as: 'admin',
    values: () => ({ userId: UNUSED_ULID }),
  },
  { method: 'GET', path: '/users/refresh', scenario: 'no token' },

  // Orders
  {
    method: 'POST',
    path: '/invoices',
    as: 'customer',
    data: ({ invoiceInput }) => invoiceInput,
    schema: createdInvoiceSchema,
  },
  { method: 'GET', path: '/invoices', as: 'customer', schema: invoicePageSchema },
  {
    method: 'GET',
    path: '/invoices/{invoiceId}',
    as: 'customer',
    values: ({ invoiceId }) => ({ invoiceId }),
    schema: invoiceSchema,
  },
  {
    method: 'GET',
    path: '/invoices/{invoiceId}',
    scenario: 'no token',
    values: ({ invoiceId }) => ({ invoiceId }),
    schema: errorResponseSchema,
  },

  // Favorites, messages and specs
  {
    method: 'POST',
    path: '/favorites',
    as: 'customer',
    data: ({ secondProductId }) => ({ product_id: secondProductId }),
    schema: favoriteSchema,
    undo: ({ customer }, id) => customer.favorites.deleteResponse(id),
  },
  {
    method: 'GET',
    path: '/favorites/{favoriteId}',
    as: 'customer',
    values: ({ favoriteId }) => ({ favoriteId }),
    schema: favoriteSchema,
  },
  {
    method: 'POST',
    path: '/messages',
    as: 'customer',
    data: () => buildMessage(),
    schema: messageSchema,
  },
  {
    method: 'GET',
    path: '/messages/{messageId}',
    scenario: 'unknown id',
    as: 'customer',
    values: () => ({ messageId: UNUSED_ULID }),
  },
  {
    method: 'POST',
    path: '/messages/{messageId}/reply',
    as: 'admin',
    values: ({ messageId }) => ({ messageId }),
    data: () => ({ message: 'A reply' }),
  },
  {
    method: 'POST',
    path: '/products/{productId}/specs',
    as: 'admin',
    values: ({ product }) => ({ productId: product.id }),
    data: () => ({ spec_name: 'Weight', spec_value: '2', spec_unit: 'kg' }),
    schema: productSpecSchema,
  },
  {
    method: 'GET',
    path: '/postcode-lookup',
    query: { country: 'NL', postcode: '1012AB' },
    schema: postcodeLookupSchema,
  },
];
