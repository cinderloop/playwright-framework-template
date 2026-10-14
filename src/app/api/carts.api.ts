import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import { cartSchema, cartUpdateResultSchema, createdCartSchema, type Cart } from '@app/schemas';

export class CartsApi extends BaseApiClient {
  /** Creates an empty cart and returns its id. */
  async create(): Promise<string> {
    const { id } = await this.parse(await this.send('POST', '/carts'), createdCartSchema, 201);
    return id;
  }

  getResponse(cartId: string): Promise<APIResponse> {
    return this.send('GET', `/carts/${cartId}`);
  }

  async get(cartId: string): Promise<Cart> {
    return this.parse(await this.getResponse(cartId), cartSchema);
  }

  addItemResponse(cartId: string, productId: string, quantity: number): Promise<APIResponse> {
    return this.send('POST', `/carts/${cartId}`, { data: { product_id: productId, quantity } });
  }

  async addItem(cartId: string, productId: string, quantity = 1): Promise<void> {
    await this.parse(
      await this.addItemResponse(cartId, productId, quantity),
      cartUpdateResultSchema,
    );
  }

  async updateQuantity(cartId: string, productId: string, quantity: number): Promise<void> {
    const response = await this.send('PUT', `/carts/${cartId}/product/quantity`, {
      data: { product_id: productId, quantity },
    });
    await this.parse(response, cartUpdateResultSchema);
  }

  async removeItem(cartId: string, productId: string): Promise<void> {
    await this.expectStatus(
      await this.send('DELETE', `/carts/${cartId}/product/${productId}`),
      204,
    );
  }

  async delete(cartId: string): Promise<void> {
    await this.expectStatus(await this.send('DELETE', `/carts/${cartId}`), 204);
  }
}
