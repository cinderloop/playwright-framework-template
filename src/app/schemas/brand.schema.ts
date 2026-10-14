import { z } from 'zod';
import { idSchema } from './common.schema';

export const brandSchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
});

export const brandListSchema = z.array(brandSchema);

export type Brand = z.infer<typeof brandSchema>;
export type BrandInput = Pick<Brand, 'name' | 'slug'>;
