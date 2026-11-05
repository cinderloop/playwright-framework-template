import { constantFrom, asyncProperty, integer, option, record, string, oneof } from 'fast-check';
import { expect, test } from '@app/fixtures';
import type { ToolshopApi } from '@app/api';
import { config } from '@app/config';
import { buildBrand } from '@app/data';
import { invalidFields, validationErrorSchema, type ProductQuery } from '@app/schemas';
import { checkProperty, localOnly } from '@core/utils';

const SORTS = ['name,asc', 'name,desc', 'price,asc', 'price,desc'] as const;
const PAGE_SIZE = 9;

/** Seeded ids are upper case, so this leaves out rows parallel tests are creating. */
const isSeeded = ({ id }: { id: string }) => id === id.toUpperCase();

async function seededFilters(api: ToolshopApi) {
  const [brands, categories] = await Promise.all([api.brands.list(), api.categories.list()]);
  return {
    brandIds: brands.filter(isSeeded).map(({ id }) => id),
    categoryIds: categories.filter(isSeeded).map(({ id }) => id),
  };
}

/** Removes the keys fast-check left empty, which `exactOptionalPropertyTypes` needs. */
function definedOnly(query: Record<string, unknown>): ProductQuery {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== null));
}

async function allPages(api: ToolshopApi, query: ProductQuery) {
  const first = await api.products.list({ ...query, page: 1 });
  const rest = await Promise.all(
    Array.from({ length: first.last_page - 1 }, (_, index) =>
      api.products.list({ ...query, page: index + 2 }),
    ),
  );
  return { first, items: [first, ...rest].flatMap((page) => page.data) };
}

// Catalogue reads are cached for up to 120 seconds, so these invariants use seeded
// filters wherever a total matters: parallel tests create products of their own.
// To repeat a failure: PROPERTY_SEED=<the test's property-seed annotation>.
test.describe('Catalogue properties', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);
  test.describe.configure({ timeout: 60_000 });

  test('a page never holds more than the page size', async ({ api }) => {
    await checkProperty(
      asyncProperty(integer({ min: 1, max: 12 }), async (page) => {
        const result = await api.products.list({ page });

        expect(result.per_page).toBe(PAGE_SIZE);
        expect(result.data.length).toBeLessThanOrEqual(PAGE_SIZE);
      }),
    );
  });

  test('every sort order holds, on every page', async ({ api }) => {
    await checkProperty(
      asyncProperty(constantFrom(...SORTS), integer({ min: 1, max: 6 }), async (sort, page) => {
        const { data } = await api.products.list({ sort, page });
        const [field, direction] = sort.split(',');
        const sign = direction === 'asc' ? 1 : -1;

        const inOrder = data.slice(1).every((product, index) => {
          const previous = data[index];
          if (!previous) return false;
          const difference =
            field === 'price'
              ? product.price - previous.price
              : product.name.localeCompare(previous.name, 'en', { sensitivity: 'base' });
          return difference * sign >= 0;
        });

        expect(inOrder, `${sort} page ${String(page)}`).toBe(true);
      }),
    );
  });

  test('filters never return anything outside the filter', async ({ api }) => {
    const { brandIds, categoryIds } = await seededFilters(api);
    let productsChecked = 0;

    await checkProperty(
      asyncProperty(
        record({
          by_brand: option(constantFrom(...brandIds)),
          by_category: option(constantFrom(...categoryIds)),
          is_rental: option(constantFrom(true, false)),
        }),
        async (filters) => {
          const { data } = await api.products.list(definedOnly(filters));
          const rental = filters.is_rental ?? false;
          productsChecked += data.length;

          for (const product of data) {
            expect(product.is_rental).toBe(rental);
            expect(product.brand.id).toBe(filters.by_brand ?? product.brand.id);
            expect(product.category.id).toBe(filters.by_category ?? product.category.id);
          }
        },
      ),
    );

    // Many combinations match nothing, and an empty page passes without proving anything.
    expect(productsChecked).toBeGreaterThan(0);
  });

  test('pages add up to the total, without gaps or repeats', async ({ api }) => {
    const { brandIds } = await seededFilters(api);

    await checkProperty(
      asyncProperty(constantFrom(...brandIds), constantFrom(...SORTS), async (brand, sort) => {
        const { first, items } = await allPages(api, { by_brand: brand, sort });

        expect(items).toHaveLength(first.total);
        expect(new Set(items.map(({ id }) => id)).size).toBe(first.total);
        expect(first.last_page).toBe(Math.max(1, Math.ceil(first.total / first.per_page)));
      }),
      { numRuns: 8 },
    );
  });
});

test.describe('Validation properties', { tag: ['@api', '@api-advanced'] }, () => {
  localOnly(config.environment);
  test.describe.configure({ timeout: 60_000 });

  test('a cart accepts every quantity from 1 to 99', async ({ api, testData }) => {
    const productId = await testData.seededProductId();

    await checkProperty(
      asyncProperty(integer({ min: 1, max: 99 }), async (quantity) => {
        const cartId = await api.carts.create();

        await api.carts.addItem(cartId, productId, quantity);

        const cart = await api.carts.get(cartId);
        expect(cart.cart_items[0]?.quantity).toBe(quantity);
        await api.carts.delete(cartId);
      }),
      { numRuns: 15 },
    );
  });

  test('a cart rejects quantities out of range', async ({ api, testData }) => {
    const productId = await testData.seededProductId();
    const cartId = await api.carts.create();

    await checkProperty(
      asyncProperty(
        oneof(integer({ min: -1_000, max: 0 }), integer({ min: 100, max: 100_000 })),
        async (quantity) => {
          const response = await api.carts.addItemResponse(cartId, productId, quantity);

          expect(response.status()).toBe(422);
        },
      ),
    );
    await api.carts.delete(cartId);
  });

  test('a cart rejects malformed quantities', async ({ api, testData }) => {
    const productId = await testData.seededProductId();
    const cartId = await api.carts.create();

    await checkProperty(
      asyncProperty(constantFrom(1.5, 'abc', '', null, [], {}), async (quantity) => {
        const response = await api.carts.addItemResponse(cartId, productId, quantity);

        expect(response.status()).toBe(422);
      }),
      { numRuns: 12 },
    );
    await api.carts.delete(cartId);
  });

  test('a brand slug rejects anything but letters, digits, dashes and underscores', async ({
    api,
  }) => {
    await checkProperty(
      asyncProperty(
        string({ minLength: 1, maxLength: 20 }).filter((slug) => /[^A-Za-z0-9_-]/.test(slug)),
        async (slug) => {
          const response = await api.brands.createResponse({ ...buildBrand(), slug });

          expect(response.status()).toBe(422);
          const error = validationErrorSchema.parse(await response.json());
          expect(invalidFields(error)).toContain('slug');
        },
      ),
    );
  });

  test('a brand name rejects anything over 120 characters', async ({ api }) => {
    await checkProperty(
      asyncProperty(integer({ min: 121, max: 400 }), async (length) => {
        const response = await api.brands.createResponse({
          ...buildBrand(),
          name: 'x'.repeat(length),
        });

        expect(response.status()).toBe(422);
      }),
      { numRuns: 10 },
    );
  });

  test('a brand name of exactly 120 characters is accepted', async ({ testData }) => {
    const name = 'x'.repeat(120);

    const brand = await testData.brand({ name });

    expect(brand.name).toBe(name);
  });
});
