import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import {
  categoryListSchema,
  categoryTreeSchema,
  createdCategorySchema,
  type Category,
  type CategoryInput,
  type CategoryNode,
  type CreatedCategory,
} from '@app/schemas';

export class CategoriesApi extends BaseApiClient {
  async list(): Promise<Category[]> {
    return this.parse(await this.send('GET', '/categories'), categoryListSchema);
  }

  async tree(): Promise<CategoryNode[]> {
    return this.parse(await this.send('GET', '/categories/tree'), categoryTreeSchema);
  }

  async create(input: CategoryInput): Promise<CreatedCategory> {
    const response = await this.send('POST', '/categories', { data: input });
    return this.parse(response, createdCategorySchema, 201);
  }

  /** Requires an admin token. */
  deleteResponse(categoryId: string): Promise<APIResponse> {
    return this.send('DELETE', `/categories/${categoryId}`);
  }
}
