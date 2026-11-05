import { z } from 'zod';
import { idSchema } from './common.schema';

export const productSpecSchema = z.object({
  id: idSchema,
  product_id: idSchema,
  spec_name: z.string(),
  spec_value: z.string(),
  spec_unit: z.string().nullable().optional(),
});

export type ProductSpec = z.infer<typeof productSpecSchema>;

export interface ProductSpecInput {
  spec_name: string;
  spec_value: string;
  spec_unit?: string;
}
