import { z } from 'zod';

/**
 * GraphQL reports refusals in the body with a `200`, so an authorization check
 * has to read this envelope rather than the status.
 */
export const graphqlResponseSchema = z.object({
  data: z.record(z.string(), z.unknown()).nullable().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

export type GraphqlResponse = z.infer<typeof graphqlResponseSchema>;
