import type { APIRequestContext } from '@playwright/test';
import type { ApiClientOptions } from '@core/api';
import { AddressesApi } from './addresses.api';
import { AuthApi } from './auth.api';
import { BrandsApi } from './brands.api';
import { CartsApi } from './carts.api';
import { CategoriesApi } from './categories.api';
import { InvoicesApi } from './invoices.api';
import { ProductsApi } from './products.api';
import { UsersApi } from './users.api';

export { AUTH_TOKEN_STORAGE_KEY } from './auth.api';

/** Every Toolshop API client, sharing one request context and (optional) token. */
export function createToolshopApi(request: APIRequestContext, options: ApiClientOptions) {
  return {
    addresses: new AddressesApi(request, options),
    auth: new AuthApi(request, options),
    brands: new BrandsApi(request, options),
    carts: new CartsApi(request, options),
    categories: new CategoriesApi(request, options),
    invoices: new InvoicesApi(request, options),
    products: new ProductsApi(request, options),
    users: new UsersApi(request, options),
  };
}

export type ToolshopApi = ReturnType<typeof createToolshopApi>;
