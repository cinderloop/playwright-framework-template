import { z } from 'zod';
import { idSchema, paginated } from './common.schema';

export const productImageSchema = z.object({
  id: idSchema,
  by_name: z.string(),
  by_url: z.string(),
  source_name: z.string(),
  source_url: z.string(),
  file_name: z.string(),
  title: z.string(),
});

export const productSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nonnegative(),
  is_location_offer: z.boolean(),
  is_rental: z.boolean(),
  in_stock: z.boolean(),
  is_eco_friendly: z.boolean(),
  co2_rating: z.enum(['A', 'B', 'C', 'D', 'E']).nullable().optional(),
  product_image: productImageSchema,
  category: z.object({ id: idSchema, name: z.string() }),
  brand: z.object({ id: idSchema, name: z.string() }),
});

export const productPageSchema = paginated(productSchema);
export const productListSchema = z.array(productSchema);
export const productImageListSchema = z.array(productImageSchema);

export type Product = z.infer<typeof productSchema>;
export type ProductPage = z.infer<typeof productPageSchema>;
export type ProductImage = z.infer<typeof productImageSchema>;

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  stock: number;
  category_id: string;
  brand_id: string;
  product_image_id: string;
  is_location_offer: boolean;
  is_rental: boolean;
}

export interface ProductQuery {
  page?: number;
  sort?: `${'name' | 'price'},${'asc' | 'desc'}`;
  by_category?: string;
  by_brand?: string;
}
