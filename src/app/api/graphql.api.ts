import type { APIResponse } from '@playwright/test';
import { BaseApiClient } from '@core/api';

/** Toolshop's undocumented GraphQL endpoint, a second route to the same data. */
export class GraphqlApi extends BaseApiClient {
  queryResponse(query: string, variables: Record<string, unknown> = {}): Promise<APIResponse> {
    return this.send('POST', '/graphql', { data: { query, variables } });
  }
}
