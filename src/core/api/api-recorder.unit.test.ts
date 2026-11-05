import type { APIRequestContext, APIResponse } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { ApiRecorder, type ApiRequestDetails } from './api-recorder';
import { BaseApiClient, type ApiClientOptions, type RequestOptions } from './base-api-client';
import { REDACTED } from './redact';

const request: ApiRequestDetails = {
  method: 'POST',
  url: 'https://api.test/login?token=abc',
  headers: { Authorization: 'Bearer abc', Accept: 'application/json' },
  data: { email: 'a@example.com', password: 'hunter2' },
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  durationMs: 12,
};

function fakeResponse(body: string | Buffer, headers: Record<string, string> = {}, status = 200) {
  const bytes = Buffer.from(body);
  return {
    status: () => status,
    url: () => 'https://api.test/login',
    headers: () => ({ 'content-type': 'application/json', ...headers }),
    body: () => Promise.resolve(bytes),
    text: () => Promise.resolve(bytes.toString('utf8')),
  } as unknown as APIResponse;
}

function exchanges(recorder: ApiRecorder) {
  return recorder.toJSON().exchanges;
}

describe('ApiRecorder', () => {
  it('stores a redacted exchange', async () => {
    const recorder = new ApiRecorder();
    await recorder.recordResponse(
      request,
      fakeResponse('{"access_token":"abc","id":1}', { 'set-cookie': 'session=abc' }),
    );

    expect(exchanges(recorder)).toEqual([
      {
        startedAt: '2026-01-01T00:00:00.000Z',
        durationMs: 12,
        method: 'POST',
        url: `https://api.test/login?token=${REDACTED}`,
        status: 200,
        request: {
          headers: { Authorization: REDACTED, Accept: 'application/json' },
          body: { email: 'a@example.com', password: REDACTED },
        },
        response: {
          headers: { 'content-type': 'application/json', 'set-cookie': REDACTED },
          body: { access_token: REDACTED, id: 1 },
        },
      },
    ]);
  });

  it('holds no secret anywhere in its serialised form', async () => {
    const recorder = new ApiRecorder();
    await recorder.recordResponse(request, fakeResponse('{"access_token":"s3cret-value"}'));

    const json = JSON.stringify(recorder);
    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('s3cret-value');
    expect(json).not.toContain('Bearer abc');
  });

  it('redacts before truncating, so a cut cannot expose a secret', async () => {
    const recorder = new ApiRecorder({ maxBodyLength: 30 });
    const body = JSON.stringify({ filler: 'x'.repeat(10), password: 'y'.repeat(100) });
    await recorder.recordResponse(request, fakeResponse(body));

    const recorded = exchanges(recorder)[0]?.response?.body;
    expect(recorded).toContain('[truncated');
    expect(JSON.stringify(recorded)).not.toContain('yyy');
  });

  it('describes binary responses instead of storing them', async () => {
    const recorder = new ApiRecorder();
    const pdf = fakeResponse(Buffer.from('%PDF-1.7'), { 'content-type': 'application/pdf' });
    await recorder.recordResponse(request, pdf);

    expect(exchanges(recorder)[0]?.response?.body).toBe('[binary, 8 bytes, application/pdf]');
  });

  it('omits an empty body', async () => {
    const recorder = new ApiRecorder();
    await recorder.recordResponse(request, fakeResponse('', {}, 204));

    expect(exchanges(recorder)[0]?.response?.body).toBeUndefined();
  });

  it('still records when the response body cannot be read', async () => {
    const recorder = new ApiRecorder();
    const disposed = {
      ...fakeResponse(''),
      body: () => Promise.reject(new Error('Response has been disposed')),
    } as unknown as APIResponse;
    await recorder.recordResponse(request, disposed);

    expect(exchanges(recorder)[0]?.response?.body).toBe(
      '[body unavailable: Response has been disposed]',
    );
  });

  it('records a failed request with a redacted message', () => {
    const recorder = new ApiRecorder();
    recorder.recordFailure(request, new Error('refused, password=hunter2'));

    expect(exchanges(recorder)[0]).toMatchObject({
      status: null,
      error: `refused, password=${REDACTED}`,
    });
    expect(exchanges(recorder)[0]?.response).toBeUndefined();
  });

  it('drops the oldest exchanges past the limit and counts them', async () => {
    const recorder = new ApiRecorder({ maxExchanges: 2 });
    for (const url of ['https://api.test/1', 'https://api.test/2', 'https://api.test/3']) {
      await recorder.recordResponse({ ...request, url }, fakeResponse('{}'));
    }

    expect(recorder.size).toBe(2);
    expect(recorder.toJSON().droppedExchanges).toBe(1);
    expect(exchanges(recorder).map((exchange) => exchange.url)).toEqual([
      'https://api.test/2',
      'https://api.test/3',
    ]);
  });

  it('uses configured keys', async () => {
    const recorder = new ApiRecorder({ sensitiveKeys: ['pin'] });
    await recorder.recordResponse(request, fakeResponse('{"pin":"1234"}'));

    expect(exchanges(recorder)[0]?.response?.body).toEqual({ pin: REDACTED });
  });
});

class TestClient extends BaseApiClient {
  call(path: string, options?: RequestOptions) {
    return this.send('GET', path, options);
  }

  check(response: APIResponse, status: number) {
    return this.expectStatus(response, status);
  }
}

function clientFor(fetch: () => Promise<APIResponse>, options: Partial<ApiClientOptions> = {}) {
  const context = { fetch } as unknown as APIRequestContext;
  return new TestClient(context, { baseUrl: 'https://api.test', token: 'abc', ...options });
}

describe('BaseApiClient recording', () => {
  it('records the call, including query parameters', async () => {
    const recorder = new ApiRecorder();
    const client = clientFor(() => Promise.resolve(fakeResponse('{}')), { recorder });

    await client.call('/products', { params: { page: 2 } });

    expect(exchanges(recorder)[0]).toMatchObject({
      method: 'GET',
      url: 'https://api.test/products?page=2',
      status: 200,
      request: { headers: { Authorization: REDACTED } },
    });
  });

  it('records a network failure and still rejects', async () => {
    const recorder = new ApiRecorder();
    const client = clientFor(() => Promise.reject(new Error('ECONNREFUSED')), { recorder });

    await expect(client.call('/products')).rejects.toThrow('ECONNREFUSED');
    expect(exchanges(recorder)[0]).toMatchObject({ status: null, error: 'ECONNREFUSED' });
  });

  it('works without a recorder', async () => {
    const response = fakeResponse('{}');
    const client = clientFor(() => Promise.resolve(response));

    await expect(client.call('/products')).resolves.toBe(response);
  });

  it('redacts the body quoted in a status error', async () => {
    const client = clientFor(() => Promise.resolve(fakeResponse('')));
    const response = fakeResponse('{"access_token":"s3cret-value"}');

    const error = await client.check(response, 201).catch((caught: unknown) => caught);

    expect(String(error)).toContain(REDACTED);
    expect(String(error)).not.toContain('s3cret-value');
  });
});
