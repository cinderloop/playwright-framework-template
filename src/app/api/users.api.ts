import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';

/** User administration; requires an admin token. */
export class UsersApi extends BaseApiClient {
  deleteResponse(userId: string): Promise<APIResponse> {
    return this.send('DELETE', `/users/${userId}`);
  }
}
