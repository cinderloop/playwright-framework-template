import { z } from 'zod';
import { idSchema } from './common.schema';

export const createdCartSchema = z.object({ id: idSchema });

export const cartUpdateResultSchema = z.object({ result: z.string() });

export const cartItemSchema = z.object({
  id: idSchema,
  quantity: z.number().int().positive(),
  discount_percentage: z.number().nullable(),
  cart_id: idSchema,
  product_id: idSchema,
  product: z.object({ id: idSchema, name: z.string(), price: z.number() }),
});

export const cartSchema = z.object({
  id: idSchema,
  additional_discount_percentage: z.number().nullable(),
  cart_items: z.array(cartItemSchema),
});

export type Cart = z.infer<typeof cartSchema>;
export type CartItem = z.infer<typeof cartItemSchema>;
