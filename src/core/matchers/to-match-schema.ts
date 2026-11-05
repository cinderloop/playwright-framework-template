import type { APIResponse, ExpectMatcherState, MatcherReturnType } from '@playwright/test';
import { z } from 'zod';
import { defaultRedactor } from '../api/redact';

/**
 * `await expect(value).toMatchSchema(schema)` passes when `schema` accepts the
 * value. An `APIResponse` is checked by its JSON body, which keeps assertions
 * typed (Playwright hides custom matchers on the `any` that `response.json()`
 * returns). Values are redacted before printing, because failures go in the report.
 */
export async function toMatchSchema(
  this: ExpectMatcherState,
  received: unknown,
  schema: z.ZodType,
): Promise<MatcherReturnType> {
  const value: unknown = isApiResponse(received) ? await received.json() : received;
  const result = schema.safeParse(value);
  const printed = this.utils.printReceived(defaultRedactor.body(value));
  const hint = this.utils.matcherHint('toMatchSchema', 'received', 'schema', {
    isNot: this.isNot,
    promise: this.promise,
  });
  return {
    name: 'toMatchSchema',
    pass: result.success,
    message: () =>
      result.success
        ? `${hint}\n\nExpected value not to match the schema, but it did:\n${printed}`
        : `${hint}\n\nSchema violations:\n${z.prettifyError(result.error)}\n\nReceived: ${printed}`,
  };
}

export function isApiResponse(value: unknown): value is APIResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'json' in value &&
    typeof value.json === 'function' &&
    'status' in value &&
    typeof value.status === 'function'
  );
}
