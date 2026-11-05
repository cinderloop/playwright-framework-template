import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import {
  adminUserSchema,
  type AdminUser,
  type ProfileUpdate,
  type WithExtraFields,
} from '@app/schemas';

export class UsersApi extends BaseApiClient {
  /** Requires an admin token. */
  listResponse(): Promise<APIResponse> {
    return this.send('GET', '/users');
  }

  searchResponse(term: string): Promise<APIResponse> {
    return this.send('GET', '/users/search', { params: { q: term } });
  }

  getResponse(userId: string): Promise<APIResponse> {
    return this.send('GET', `/users/${userId}`);
  }

  /** Requires an admin token: only admins see role and account state. */
  async get(userId: string): Promise<AdminUser> {
    return this.parse(await this.getResponse(userId), adminUserSchema);
  }

  updateResponse(userId: string, input: WithExtraFields<ProfileUpdate>): Promise<APIResponse> {
    return this.send('PUT', `/users/${userId}`, { data: input });
  }

  patchResponse(
    userId: string,
    input: WithExtraFields<Partial<ProfileUpdate>>,
  ): Promise<APIResponse> {
    return this.send('PATCH', `/users/${userId}`, { data: input });
  }

  /** Requires an admin token. */
  deleteResponse(userId: string): Promise<APIResponse> {
    return this.send('DELETE', `/users/${userId}`);
  }
}
