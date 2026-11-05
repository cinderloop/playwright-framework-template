import type { APIRequestContext, APIResponse } from '@playwright/test';
import { z } from 'zod';
import type { ApiRecorder } from './api-recorder';
import { defaultRedactor, type Redactor } from './redact';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiClientOptions {
  /** Absolute base URL of the API, e.g. `http://localhost:8091`. */
  baseUrl: string;
  /** Bearer token sent on every request; omit for anonymous calls. */
  token?: string | undefined;
  /** Logs every call for the failure report; omit to record nothing. */
  recorder?: ApiRecorder | undefined;
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

  protected async send(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<APIResponse> {
    const headers: Record<string, string> = { Accept: 'application/json', ...options.headers };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }
    const url = new URL(path, this.options.baseUrl).href;
    const fetchOptions = {
      method,
      headers,
      ...(options.params ? { params: options.params } : {}),
      ...(options.data === undefined ? {} : { data: options.data }),
    };

    const { recorder } = this.options;
    if (!recorder) {
      return this.request.fetch(url, fetchOptions);
    }

    const startedAt = new Date();
    const details = () => ({
      method,
      url: withQuery(url, options.params),
      headers,
      data: options.data,
      startedAt,
      durationMs: Date.now() - startedAt.getTime(),
    });
    let response: APIResponse;
    try {
      response = await this.request.fetch(url, fetchOptions);
    } catch (error) {
      recorder.recordFailure(details(), error);
      throw error;
    }
    await recorder.recordResponse(details(), response);
    return response;
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
        `${this.requestLabel(response)} returned a body that does not match its schema:\n${z.prettifyError(result.error)}`,
        response.status(),
        await response.text(),
      );
    }
    return result.data;
  }

  private get redactor(): Redactor {
    return this.options.recorder?.redactor ?? defaultRedactor;
  }

  private requestLabel(response: APIResponse): string {
    const { pathname, search } = new URL(this.redactor.url(response.url()));
    return `${pathname}${search}`;
  }

  protected async expectStatus(response: APIResponse, expectedStatus: number): Promise<void> {
    if (response.status() !== expectedStatus) {
      const body = await response.text();
      const redacted = JSON.stringify(this.redactor.body(body));
      throw new ApiError(
        `${this.requestLabel(response)} returned ${String(response.status())}, expected ${String(expectedStatus)}: ${redacted.slice(0, 500)}`,
        response.status(),
        body,
      );
    }
  }
}

function withQuery(url: string, params: RequestOptions['params']): string {
  const result = new URL(url);
  for (const [name, value] of Object.entries(params ?? {})) {
    result.searchParams.set(name, String(value));
  }
  return result.href;
}
