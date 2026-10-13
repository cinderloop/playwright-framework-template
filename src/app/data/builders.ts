import { faker } from '@faker-js/faker';
import { defineFactory } from '@core/data';
import { uniqueSuffix } from '@core/utils';
import type {
  BrandInput,
  CategoryInput,
  PostcodeLookup,
  ProductInput,
  RegistrationInput,
} from '@app/schemas';

// Builders produce valid request payloads; nothing here talks to the API.
// Names carry a unique suffix so parallel tests never collide on unique columns.

function uniqueName(base: string): string {
  return `${base} ${uniqueSuffix()}`;
}

function slugOf(name: string): string {
  return faker.helpers.slugify(name).toLowerCase();
}

export const buildBrand = defineFactory<BrandInput>(() => {
  const name = uniqueName(faker.company.name());
  return { name, slug: slugOf(name) };
});

export const buildCategory = defineFactory<CategoryInput>(() => {
  const name = uniqueName(faker.commerce.department());
  return { name, slug: slugOf(name) };
});

export interface ProductReferences {
  category_id: string;
  brand_id: string;
  product_image_id: string;
}

export function buildProduct(
  references: ProductReferences,
  overrides: Partial<ProductInput> = {},
): ProductInput {
  return {
    name: uniqueName(faker.commerce.productName()),
    description: faker.commerce.productDescription(),
    price: Number(faker.commerce.price({ min: 5, max: 95 })),
    stock: faker.number.int({ min: 5, max: 50 }),
    is_location_offer: false,
    is_rental: false,
    ...references,
    ...overrides,
  };
}

/**
 * A new customer whose address matches the API's postcode lookup, so it can
 * check out (billing addresses that disagree with the lookup are rejected).
 */
export function buildCustomer(
  address: PostcodeLookup,
  overrides: Partial<RegistrationInput> = {},
): RegistrationInput {
  const firstName = faker.person.firstName();
  return {
    first_name: firstName,
    last_name: faker.person.lastName().slice(0, 20),
    email: `${slugOf(firstName)}.${uniqueSuffix()}@example.com`,
    // Toolshop requires mixed case, digits and symbols.
    password: `${faker.internet.password({ length: 12 })}Aa1!`,
    phone: faker.string.numeric(10),
    dob: faker.date.birthdate({ mode: 'age', min: 25, max: 60 }).toISOString().slice(0, 10),
    address: {
      street: address.street,
      house_number: address.house_number ?? faker.location.buildingNumber(),
      city: address.city,
      state: address.state,
      country: address.country,
      postal_code: address.postcode,
    },
    ...overrides,
  };
}
