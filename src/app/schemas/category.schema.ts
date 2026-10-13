import { z } from 'zod';
import { idSchema } from './common.schema';

export const categorySchema = z.object({
  id: idSchema,
  name: z.string(),
  slug: z.string(),
  parent_id: idSchema.nullable(),
});

export type Category = z.infer<typeof categorySchema>;
export type CreatedCategory = z.infer<typeof createdCategorySchema>;
export type CategoryNode = Category & { sub_categories: CategoryNode[] };

export const categoryTreeNodeSchema: z.ZodType<CategoryNode> = categorySchema.extend({
  get sub_categories() {
    return z.array(categoryTreeNodeSchema);
  },
});

/** `POST /categories` echoes the input, so `parent_id` is absent when none was sent. */
export const createdCategorySchema = categorySchema.partial({ parent_id: true });

export const categoryListSchema = z.array(categorySchema);
export const categoryTreeSchema = z.array(categoryTreeNodeSchema);

export interface CategoryInput {
  name: string;
  slug: string;
  parent_id?: string | null;
}
