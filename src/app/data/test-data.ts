import { faker } from '@faker-js/faker';
import type { APIResponse, TestInfo } from '@playwright/test';
import type { CleanupQueue } from '@core/utils';
import type { ToolshopApi } from '@app/api';
import type { Credentials } from '@app/config';
import type {
  Brand,
  BrandInput,
  CreatedCategory,
  CategoryInput,
  Product,
  ProductInput,
  RegistrationInput,
  User,
} from '@app/schemas';
import { buildBrand, buildCategory, buildCustomer, buildProduct } from './builders';

export interface NewCustomer {
  user: User;
  credentials: Credentials;
  token: string;
  api: ToolshopApi;
}

interface TestDataDeps {
  api: ToolshopApi;
  adminApi: ToolshopApi;
  apiWithToken: (token: string) => ToolshopApi;
  cleanup: CleanupQueue;
  testInfo: TestInfo;
}

/**
 * Creates Toolshop entities through the API for one test and registers their
 * deletion; the owning fixture drains the queue after the test. Creation needs no auth in Toolshop;
 * deletion uses an admin token.
 */
export class TestData {
  constructor(private readonly deps: TestDataDeps) {}

  async brand(overrides: Partial<BrandInput> = {}): Promise<Brand> {
    const brand = await this.deps.api.brands.create(buildBrand(overrides));
    this.deleteLater(`brand ${brand.name}`, () =>
      this.deps.adminApi.brands.deleteResponse(brand.id),
    );
    return brand;
  }

  async category(overrides: Partial<CategoryInput> = {}): Promise<CreatedCategory> {
    const category = await this.deps.api.categories.create(buildCategory(overrides));
    this.deleteLater(`category ${category.name}`, () =>
      this.deps.adminApi.categories.deleteResponse(category.id),
    );
    return category;
  }

  /**
   * A product. Unless `category_id` / `brand_id` are given, it gets its own new
   * category and brand, so it never shows up in another test's filters.
   */
  async product(overrides: Partial<ProductInput> = {}): Promise<Product> {
    const [categoryId, brandId, images] = await Promise.all([
      overrides.category_id ?? this.category().then(({ id }) => id),
      overrides.brand_id ?? this.brand().then(({ id }) => id),
      this.deps.api.products.images(),
    ]);
    const image = faker.helpers.arrayElement(images);
    const product = await this.deps.api.products.create(
      buildProduct(
        { category_id: categoryId, brand_id: brandId, product_image_id: image.id },
        overrides,
      ),
    );
    this.deleteLater(`product ${product.name}`, () =>
      this.deps.adminApi.products.deleteResponse(product.id),
    );
    return product;
  }

  /** Registers a new customer and signs them in through the API. */
  async customer(overrides: Partial<RegistrationInput> = {}): Promise<NewCustomer> {
    const address = await this.deps.api.addresses.lookup('US', faker.location.zipCode('#####'));
    const input = buildCustomer(address, overrides);
    const user = await this.deps.api.auth.register(input);
    this.deleteLater(`customer ${user.email}`, () =>
      this.deps.adminApi.users.deleteResponse(user.id),
    );

    const credentials = { email: input.email, password: input.password };
    const { access_token: token } = await this.deps.api.auth.login(credentials);
    return { user, credentials, token, api: this.deps.apiWithToken(token) };
  }

  /**
   * Toolshop has no API to delete orders, so anything an order references
   * (its customer, its products) is rejected with 409. That data is kept and
   * recorded as a `retained-data` annotation instead of failing the test;
   * CI starts every run from a freshly seeded database.
   */
  private deleteLater(description: string, remove: () => Promise<APIResponse>): void {
    this.deps.cleanup.add(`delete ${description}`, async () => {
      const response = await remove();
      if (response.status() === 409) {
        this.deps.testInfo.annotations.push({
          type: 'retained-data',
          description: `${description} is referenced by an order and cannot be deleted`,
        });
        return;
      }
      if (![204, 404].includes(response.status())) {
        throw new Error(
          `Could not delete ${description}: ${String(response.status())} ${await response.text()}`,
        );
      }
    });
  }
}
