import type { APIResponse } from '@playwright/test';
import { BaseApiClient, type HttpMethod, type RequestOptions } from '@core/api';

/** Any request at all, for negative tests of routes and methods that do not exist. */
export class RawApi extends BaseApiClient {
  response(method: HttpMethod, path: string, options?: RequestOptions): Promise<APIResponse> {
    return this.send(method, path, options);
  }
}
