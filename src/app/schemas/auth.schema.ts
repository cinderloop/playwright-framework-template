import { z } from 'zod';

export const loginResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('bearer'),
  expires_in: z.number().int().positive(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
