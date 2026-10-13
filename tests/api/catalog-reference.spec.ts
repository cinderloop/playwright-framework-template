import { expect, test } from '@app/fixtures';
import { invalidFields, validationErrorSchema } from '@app/schemas';

test.describe('Categories and brands API', { tag: '@api' }, () => {
  test('the category tree nests sub-categories under their parent', async ({ api }) => {
    const tree = await api.categories.tree();

    expect(tree.length).toBeGreaterThan(0);
    for (const parent of tree) {
      expect(parent.parent_id).toBeNull();
      for (const child of parent.sub_categories) {
        expect(child.parent_id).toBe(parent.id);
      }
    }
  });

  test('a created category is listed', async ({ testData, api }) => {
    const category = await testData.category();

    const categories = await api.categories.list();

    expect(categories).toContainEqual(
      expect.objectContaining({ id: category.id, slug: category.slug }),
    );
  });

  test('a created brand can be read back', async ({ testData, api }) => {
    const brand = await testData.brand();

    expect(await api.brands.get(brand.id)).toEqual(brand);
  });

  test('brand slugs must be unique', async ({ testData, api }) => {
    const brand = await testData.brand();

    const duplicate = await api.brands.createResponse({ name: 'Duplicate', slug: brand.slug });

    expect(duplicate.status()).toBe(409);
    expect(invalidFields(validationErrorSchema.parse(await duplicate.json()))).toEqual(['slug']);
  });

  test('brand creation validates the slug format', async ({ api, uniqueId }) => {
    const response = await api.brands.createResponse({
      name: 'Bad slug',
      slug: `not a slug ${uniqueId}`,
    });

    expect(response.status()).toBe(422);
    expect(invalidFields(validationErrorSchema.parse(await response.json()))).toEqual(['slug']);
  });
});
