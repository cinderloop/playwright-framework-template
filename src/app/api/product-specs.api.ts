import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import { productSpecSchema, type ProductSpec, type ProductSpecInput } from '@app/schemas';

export class ProductSpecsApi extends BaseApiClient {
  createResponse(productId: string, input: ProductSpecInput): Promise<APIResponse> {
    return this.send('POST', `/products/${productId}/specs`, { data: input });
  }

  async create(productId: string, input: ProductSpecInput): Promise<ProductSpec> {
    return this.parse(await this.createResponse(productId, input), productSpecSchema, 201);
  }

  updateResponse(
    productId: string,
    specId: string,
    input: Partial<ProductSpecInput>,
  ): Promise<APIResponse> {
    return this.send('PUT', `/products/${productId}/specs/${specId}`, { data: input });
  }

  deleteResponse(productId: string, specId: string): Promise<APIResponse> {
    return this.send('DELETE', `/products/${productId}/specs/${specId}`);
  }
}
