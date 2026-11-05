import type { APIRequestContext } from '@playwright/test';
import type { ApiClientOptions } from '@core/api';
import { AddressesApi } from './addresses.api';
import { AuthApi } from './auth.api';
import { BrandsApi } from './brands.api';
import { CartsApi } from './carts.api';
import { CategoriesApi } from './categories.api';
import { FavoritesApi } from './favorites.api';
import { GraphqlApi } from './graphql.api';
import { InvoicesApi } from './invoices.api';
import { MessagesApi } from './messages.api';
import { ProductSpecsApi } from './product-specs.api';
import { ProductsApi } from './products.api';
import { ReportsApi } from './reports.api';
import { UsersApi } from './users.api';

export { AUTH_TOKEN_STORAGE_KEY } from './auth.api';
export { reportNames } from './reports.api';
export type { ReportName } from './reports.api';

/** Every Toolshop API client, sharing one request context and (optional) token. */
export function createToolshopApi(request: APIRequestContext, options: ApiClientOptions) {
  return {
    addresses: new AddressesApi(request, options),
    auth: new AuthApi(request, options),
    brands: new BrandsApi(request, options),
    carts: new CartsApi(request, options),
    categories: new CategoriesApi(request, options),
    favorites: new FavoritesApi(request, options),
    graphql: new GraphqlApi(request, options),
    invoices: new InvoicesApi(request, options),
    messages: new MessagesApi(request, options),
    products: new ProductsApi(request, options),
    productSpecs: new ProductSpecsApi(request, options),
    reports: new ReportsApi(request, options),
    users: new UsersApi(request, options),
  };
}

export type ToolshopApi = ReturnType<typeof createToolshopApi>;
