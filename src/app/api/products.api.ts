import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import {
  productImageListSchema,
  productPageSchema,
  productSchema,
  type Product,
  type ProductImage,
  type ProductInput,
  type ProductPage,
  type ProductQuery,
} from '@app/schemas';

export class ProductsApi extends BaseApiClient {
  async list(query: ProductQuery = {}): Promise<ProductPage> {
    return this.parse(
      await this.send('GET', '/products', { params: { ...query } }),
      productPageSchema,
    );
  }

  async search(term: string, page = 1): Promise<ProductPage> {
    const response = await this.send('GET', '/products/search', { params: { q: term, page } });
    return this.parse(response, productPageSchema);
  }

  getResponse(productId: string): Promise<APIResponse> {
    return this.send('GET', `/products/${productId}`);
  }

  async get(productId: string): Promise<Product> {
    return this.parse(await this.getResponse(productId), productSchema);
  }

  createResponse(input: Partial<ProductInput>): Promise<APIResponse> {
    return this.send('POST', '/products', { data: input });
  }

  async create(input: ProductInput): Promise<Product> {
    return this.parse(await this.createResponse(input), productSchema, 201);
  }

  /** Requires an admin token. */
  deleteResponse(productId: string): Promise<APIResponse> {
    return this.send('DELETE', `/products/${productId}`);
  }

  async images(): Promise<ProductImage[]> {
    return this.parse(await this.send('GET', '/images'), productImageListSchema);
  }
}
