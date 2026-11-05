import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import { favoriteSchema, type Favorite } from '@app/schemas';

/** A customer's saved products. Every endpoint requires a token. */
export class FavoritesApi extends BaseApiClient {
  async create(productId: string, extraFields: Record<string, unknown> = {}): Promise<Favorite> {
    const response = await this.send('POST', '/favorites', {
      data: { ...extraFields, product_id: productId },
    });
    return this.parse(response, favoriteSchema, 201);
  }

  listResponse(): Promise<APIResponse> {
    return this.send('GET', '/favorites');
  }

  getResponse(favoriteId: string): Promise<APIResponse> {
    return this.send('GET', `/favorites/${favoriteId}`);
  }

  deleteResponse(favoriteId: string): Promise<APIResponse> {
    return this.send('DELETE', `/favorites/${favoriteId}`);
  }
}
