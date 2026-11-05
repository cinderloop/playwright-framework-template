import { z } from 'zod';
import { idSchema } from './common.schema';

export const messageStatuses = ['NEW', 'IN_PROGRESS', 'RESOLVED'] as const;

/** `POST /messages`. `user_id` is present only when the sender was signed in. */
export const messageSchema = z.object({
  id: idSchema,
  user_id: idSchema.nullable().optional(),
  subject: z.string(),
  message: z.string(),
  status: z.enum(messageStatuses),
});

export type Message = z.infer<typeof messageSchema>;
export type MessageStatus = (typeof messageStatuses)[number];

export interface MessageInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}
