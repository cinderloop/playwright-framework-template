import type { APIResponse } from '@playwright/test';
import { createRedactor, truncateBody, type Redactor, type RedactorOptions } from './redact';

export interface ApiRecorderOptions extends RedactorOptions {
  /** Longest body kept, in characters of JSON. */
  maxBodyLength?: number;
  /** Most exchanges kept per test; the oldest are dropped first. */
  maxExchanges?: number;
}

export interface RecordedMessage {
  headers: Record<string, string>;
  body?: unknown;
}

/** One request and its outcome, already redacted. */
export interface ApiExchange {
  startedAt: string;
  durationMs: number;
  method: string;
  url: string;
  /** `null` when no response arrived; see `error`. */
  status: number | null;
  request: RecordedMessage;
  response?: RecordedMessage;
  error?: string;
}

export interface ApiRequestDetails {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: unknown;
  startedAt: Date;
  durationMs: number;
}

const DEFAULT_MAX_BODY_LENGTH = 10_000;
const DEFAULT_MAX_EXCHANGES = 200;
const TEXT_CONTENT_TYPE = /json|text|xml|javascript|x-www-form-urlencoded/i;

/**
 * Keeps a redacted log of the API calls made during one test. Values are
 * masked as they arrive, so raw secrets are never held here and cannot reach
 * a report. Recording never changes a test's outcome: a response that cannot
 * be read is logged as such.
 */
export class ApiRecorder {
  readonly redactor: Redactor;

  private readonly maxBodyLength: number;
  private readonly maxExchanges: number;
  private readonly exchanges: ApiExchange[] = [];
  private dropped = 0;

  constructor(options: ApiRecorderOptions = {}) {
    this.redactor = createRedactor(options);
    this.maxBodyLength = options.maxBodyLength ?? DEFAULT_MAX_BODY_LENGTH;
    this.maxExchanges = options.maxExchanges ?? DEFAULT_MAX_EXCHANGES;
  }

  get size(): number {
    return this.exchanges.length;
  }

  async recordResponse(request: ApiRequestDetails, response: APIResponse): Promise<void> {
    const headers = response.headers();
    this.add({
      ...this.describe(request),
      status: response.status(),
      response: {
        headers: this.redactor.headers(headers),
        body: await this.readBody(response, headers['content-type'] ?? ''),
      },
    });
  }

  /** For a request that produced no response, e.g. a refused connection. */
  recordFailure(request: ApiRequestDetails, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.add({ ...this.describe(request), status: null, error: this.redactor.text(message) });
  }

  toJSON(): { droppedExchanges: number; exchanges: readonly ApiExchange[] } {
    return { droppedExchanges: this.dropped, exchanges: this.exchanges };
  }

  private describe(request: ApiRequestDetails): Omit<ApiExchange, 'status'> {
    return {
      startedAt: request.startedAt.toISOString(),
      durationMs: request.durationMs,
      method: request.method,
      url: this.redactor.url(request.url),
      request: {
        headers: this.redactor.headers(request.headers),
        ...(request.data === undefined ? {} : { body: this.prepare(request.data) }),
      },
    };
  }

  private async readBody(response: APIResponse, contentType: string): Promise<unknown> {
    try {
      const bytes = await response.body();
      if (bytes.byteLength === 0) return undefined;
      if (contentType !== '' && !TEXT_CONTENT_TYPE.test(contentType)) {
        return `[binary, ${String(bytes.byteLength)} bytes, ${contentType}]`;
      }
      return this.prepare(bytes.toString('utf8'));
    } catch (error) {
      return `[body unavailable: ${error instanceof Error ? error.message : String(error)}]`;
    }
  }

  private prepare(body: unknown): unknown {
    return truncateBody(this.redactor.body(body), this.maxBodyLength);
  }

  private add(exchange: ApiExchange): void {
    this.exchanges.push(exchange);
    if (this.exchanges.length > this.maxExchanges) {
      this.exchanges.shift();
      this.dropped += 1;
    }
  }
}
