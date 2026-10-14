import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import { brandListSchema, brandSchema, type Brand, type BrandInput } from '@app/schemas';

export class BrandsApi extends BaseApiClient {
  async list(): Promise<Brand[]> {
    return this.parse(await this.send('GET', '/brands'), brandListSchema);
  }

  getResponse(brandId: string): Promise<APIResponse> {
    return this.send('GET', `/brands/${brandId}`);
  }

  async get(brandId: string): Promise<Brand> {
    return this.parse(await this.getResponse(brandId), brandSchema);
  }

  createResponse(input: Partial<BrandInput>): Promise<APIResponse> {
    return this.send('POST', '/brands', { data: input });
  }

  async create(input: BrandInput): Promise<Brand> {
    return this.parse(await this.createResponse(input), brandSchema, 201);
  }

  /** Requires an admin token. */
  deleteResponse(brandId: string): Promise<APIResponse> {
    return this.send('DELETE', `/brands/${brandId}`);
  }
}
