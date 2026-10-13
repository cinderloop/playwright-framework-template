import { z } from 'zod';

/** Toolshop ids are ULIDs; seeded rows use upper case, rows created at runtime lower case. */
export const idSchema = z.string().regex(/^[0-9A-Za-z]{26}$/, 'expected a 26-character ULID');

/** Laravel length-aware paginator envelope. */
export function paginated<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    current_page: z.number().int().positive(),
    data: z.array(item),
    from: z.number().int().nullable(),
    to: z.number().int().nullable(),
    last_page: z.number().int().positive(),
    per_page: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  });
}

const fieldErrorsSchema = z.record(z.string(), z.array(z.string()).nonempty());

/**
 * 422 body. Most endpoints return the field map directly; some (e.g. carts) use
 * Laravel's default `{ message, errors }` envelope.
 */
const laravelValidationSchema = z.object({ message: z.string(), errors: fieldErrorsSchema });

export const validationErrorSchema = z.union([laravelValidationSchema, fieldErrorsSchema]);

/** Field names that failed validation, whichever 422 shape the endpoint uses. */
export function invalidFields(error: ValidationError): string[] {
  const envelope = laravelValidationSchema.safeParse(error);
  return Object.keys(envelope.success ? envelope.data.errors : error).sort();
}

/** 401/403/404 bodies use either `message` or `error`. */
export const errorMessageSchema = z.union([
  z.object({ message: z.string() }),
  z.object({ error: z.string() }),
]);

export type ValidationError = z.infer<typeof validationErrorSchema>;
