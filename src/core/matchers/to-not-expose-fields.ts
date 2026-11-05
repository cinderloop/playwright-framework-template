import type { ExpectMatcherState, MatcherReturnType } from '@playwright/test';
import { findExposedFields } from './exposed-fields';
import { isApiResponse } from './to-match-schema';

/**
 * `await expect(response).toNotExposeFields(['password'])` passes when no field
 * with one of those names appears anywhere in the body. Only paths are printed,
 * never values, so a failure cannot copy the secret into a report.
 */
export async function toNotExposeFields(
  this: ExpectMatcherState,
  received: unknown,
  fields: readonly string[],
): Promise<MatcherReturnType> {
  const value: unknown = isApiResponse(received) ? await received.json() : received;
  const exposed = findExposedFields(value, fields);
  const hint = this.utils.matcherHint('toNotExposeFields', 'received', 'fields', {
    isNot: this.isNot,
    promise: this.promise,
  });
  return {
    name: 'toNotExposeFields',
    pass: exposed.length === 0,
    message: () =>
      exposed.length === 0
        ? `${hint}\n\nExpected at least one of these fields, but found none: ${fields.join(', ')}`
        : `${hint}\n\nExposed fields:\n${exposed.map((path) => `  ${path}`).join('\n')}`,
  };
}
