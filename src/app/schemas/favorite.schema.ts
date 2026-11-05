import { z } from 'zod';
import { idSchema } from './common.schema';

export const favoriteSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  product_id: idSchema,
});

export type Favorite = z.infer<typeof favoriteSchema>;
