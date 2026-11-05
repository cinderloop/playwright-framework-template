import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';
import type { ProfileUpdate } from '@app/schemas';

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

  updateResponse(userId: string, input: ProfileUpdate): Promise<APIResponse> {
    return this.send('PUT', `/users/${userId}`, { data: input });
  }

  patchResponse(userId: string, input: Partial<ProfileUpdate>): Promise<APIResponse> {
    return this.send('PATCH', `/users/${userId}`, { data: input });
  }

  /** Requires an admin token. */
  deleteResponse(userId: string): Promise<APIResponse> {
    return this.send('DELETE', `/users/${userId}`);
  }
}
