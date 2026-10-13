import type { APIRequestContext, APIResponse } from '@playwright/test';
import { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiClientOptions {
  /** Absolute base URL of the API, e.g. `http://localhost:8091`. */
  baseUrl: string;
  /** Bearer token sent on every request; omit for anonymous calls. */
  token?: string | undefined;
}

export interface RequestOptions {
  params?: Record<string, string | number | boolean>;
  data?: unknown;
  headers?: Record<string, string>;
}

/** Thrown when a response has an unexpected status or a body that breaks its schema. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
  }
}

/**
 * Typed wrapper around Playwright's `APIRequestContext`. Subclasses describe
 * one resource each and expose two kinds of method:
 *
 * - `xResponse(...)` returns the raw `APIResponse` whatever its status, for
 *   negative tests that assert on 4xx responses;
 * - `x(...)` requires the expected status and returns the body parsed through
 *   a Zod schema, so callers get validated, inferred types.
 */
export abstract class BaseApiClient {
  constructor(
    protected readonly request: APIRequestContext,
    protected readonly options: ApiClientOptions,
  ) {}

  protected send(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<APIResponse> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }
    return this.request.fetch(new URL(path, this.options.baseUrl).href, {
      method,
      headers,
      ...(options.params ? { params: options.params } : {}),
      ...(options.data === undefined ? {} : { data: options.data }),
    });
  }

  /** Asserts the status and parses the JSON body with `schema`. */
  protected async parse<TSchema extends z.ZodType>(
    response: APIResponse,
    schema: TSchema,
    expectedStatus = 200,
  ): Promise<z.output<TSchema>> {
    await this.expectStatus(response, expectedStatus);
    const result = schema.safeParse(await response.json());
    if (!result.success) {
      throw new ApiError(
        `${requestLabel(response)} returned a body that does not match its schema:\n${z.prettifyError(result.error)}`,
        response.status(),
        await response.text(),
      );
    }
    return result.data;
  }

  protected async expectStatus(response: APIResponse, expectedStatus: number): Promise<void> {
    if (response.status() !== expectedStatus) {
      const body = await response.text();
      throw new ApiError(
        `${requestLabel(response)} returned ${String(response.status())}, expected ${String(expectedStatus)}: ${body.slice(0, 500)}`,
        response.status(),
        body,
      );
    }
  }
}

function requestLabel(response: APIResponse): string {
  const url = new URL(response.url());
  return `${url.pathname}${url.search}`;
}
