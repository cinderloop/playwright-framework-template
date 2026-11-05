import { faker } from '@faker-js/faker';
import type { APIResponse, TestInfo } from '@playwright/test';
import { pollUntil, type CleanupQueue } from '@core/utils';
import type { ToolshopApi } from '@app/api';
import type { Credentials } from '@app/config';
import type {
  Brand,
  BrandInput,
  CreatedCategory,
  CreatedInvoice,
  CategoryInput,
  InvoiceInput,
  Product,
  ProductInput,
  RegistrationInput,
  User,
  WithExtraFields,
} from '@app/schemas';
import { buildBrand, buildCategory, buildCustomer, buildProduct } from './builders';

const PDF_WAIT = 150_000;

/** A well-formed id that no row has, for requests about something that does not exist. */
export const UNKNOWN_ID = '01ZZZZZZZZZZZZZZZZZZZZZZZZ';

export interface NewCustomer {
  user: User;
  credentials: Credentials;
  token: string;
  api: ToolshopApi;
}

export interface RegisteredCustomer {
  user: User;
  input: RegistrationInput;
}

export interface PlacedOrder {
  invoice: CreatedInvoice;
  input: InvoiceInput;
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

  /** An empty cart. It must go before its products, which it would otherwise keep alive. */
  async cart(): Promise<string> {
    const cartId = await this.deps.api.carts.create();
    this.deleteLater(`cart ${cartId}`, () => this.deps.api.carts.deleteResponse(cartId));
    return cartId;
  }

  /** A seeded product with no special cart rules. */
  async seededProductId(): Promise<string> {
    const { data } = await this.deps.api.products.list();
    const product = data.find(({ name }) => name !== 'Thor Hammer');
    if (!product) throw new Error('The catalog is empty; has Toolshop been seeded?');
    return product.id;
  }

  /** Registers a new customer without signing in, so account state stays as registered. */
  async registered(
    overrides: WithExtraFields<Partial<RegistrationInput>> = {},
  ): Promise<RegisteredCustomer> {
    const address = await this.deps.api.addresses.lookup('US', faker.location.zipCode('#####'));
    const input = buildCustomer(address, overrides);
    const user = await this.deps.api.auth.register(input);
    this.deleteLater(`customer ${user.email}`, () => this.deleteCustomer(user.id));
    return { user, input };
  }

  /** Registers a new customer and signs them in through the API. */
  async customer(
    overrides: WithExtraFields<Partial<RegistrationInput>> = {},
  ): Promise<NewCustomer> {
    const { user, input } = await this.registered(overrides);
    const credentials = { email: input.email, password: input.password };
    const { access_token: token } = await this.deps.api.auth.login(credentials);
    return { user, credentials, token, api: this.deps.apiWithToken(token) };
  }

  /**
   * A valid checkout request with a filled cart. It buys a seeded rental: orders
   * cannot be deleted, so a created product would be left behind by each one, and
   * rentals have no stock count, so orders cannot sell out the products UI tests open.
   */
  async orderInput(
    customer: NewCustomer,
    overrides: WithExtraFields<Partial<InvoiceInput>> = {},
  ): Promise<InvoiceInput> {
    const { data } = await this.deps.api.products.list({ is_rental: true });
    const [product] = data;
    if (!product) throw new Error('No rentals found; has Toolshop been seeded?');

    const cartId = await customer.api.carts.create();
    await customer.api.carts.addItem(cartId, product.id);

    const { address } = customer.user;
    return {
      cart_id: cartId,
      payment_method: 'cash-on-delivery',
      payment_details: {},
      billing_street: address.street ?? '',
      billing_city: address.city ?? '',
      billing_state: address.state ?? '',
      billing_country: address.country ?? '',
      billing_postal_code: address.postal_code ?? '',
      ...overrides,
    };
  }

  /** A completed checkout. */
  async order(
    customer: NewCustomer,
    overrides: WithExtraFields<Partial<InvoiceInput>> = {},
  ): Promise<PlacedOrder> {
    const input = await this.orderInput(customer, overrides);
    return { invoice: await customer.api.invoices.create(input), input };
  }

  /**
   * Waits for the worker to generate an invoice's PDF. A freshly seeded stack has
   * about 200 invoices queued ahead of it, so the first one takes over a minute.
   */
  async generatedPdf({ api }: NewCustomer, invoiceNumber: string): Promise<void> {
    this.deps.testInfo.setTimeout(PDF_WAIT + 60_000);
    await pollUntil(
      () => api.invoices.pdfStatus(invoiceNumber),
      (status) => status === 'COMPLETED',
      {
        description: `the PDF of ${invoiceNumber} to be generated`,
        timeout: PDF_WAIT,
        intervals: [1_000, 2_000],
      },
    );
  }

  /** Deleting a user who is already gone answers 500, not 404 (F-24), so look first. */
  private async deleteCustomer(userId: string): Promise<APIResponse> {
    const { users } = this.deps.adminApi;
    const existing = await users.getResponse(userId);
    return existing.status() === 404 ? existing : users.deleteResponse(userId);
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
