import type { AuthorizationContext } from '@core/authorization';
import type { ToolshopApi } from '@app/api';
import { buildMessage, type NewCustomer, type TestData } from '@app/data';
import type { Favorite, InvoiceInput, Message } from '@app/schemas';

/**
 * Who a row acts as. `owner` holds the resource and `other-user` is a second
 * customer. `customer` is that same second customer, named for rows about a
 * role rather than ownership.
 */
export type ToolshopActor = 'anonymous' | 'owner' | 'other-user' | 'customer' | 'admin';

export interface OwnedInvoice {
  owner: NewCustomer;
  id: string;
  invoiceNumber: string;
  input: InvoiceInput;
}

export interface OwnedFavorite {
  owner: NewCustomer;
  favorite: Favorite;
}

export interface OwnedMessage {
  owner: NewCustomer;
  message: Message;
}

interface ContextDeps {
  api: ToolshopApi;
  adminApi: ToolshopApi;
  testData: TestData;
}

/** Actors and arrange steps for one matrix row. Customers are created on first use. */
export class ToolshopAuthorizationContext implements AuthorizationContext<
  ToolshopActor,
  ToolshopApi
> {
  private ownerCustomer?: Promise<NewCustomer>;
  private otherCustomer?: Promise<NewCustomer>;

  constructor(private readonly deps: ContextDeps) {}

  get testData(): TestData {
    return this.deps.testData;
  }

  get adminApi(): ToolshopApi {
    return this.deps.adminApi;
  }

  owner(): Promise<NewCustomer> {
    this.ownerCustomer ??= this.deps.testData.customer();
    return this.ownerCustomer;
  }

  private other(): Promise<NewCustomer> {
    this.otherCustomer ??= this.deps.testData.customer();
    return this.otherCustomer;
  }

  async actor(name: ToolshopActor): Promise<ToolshopApi> {
    switch (name) {
      case 'anonymous':
        return this.deps.api;
      case 'admin':
        return this.deps.adminApi;
      case 'owner':
        return (await this.owner()).api;
      case 'other-user':
      case 'customer':
        return (await this.other()).api;
    }
  }

  /**
   * A completed checkout. It uses a seeded product because orders cannot be
   * deleted, so a created product would be left behind by every row.
   */
  async invoice(): Promise<OwnedInvoice> {
    const owner = await this.owner();
    const productId = await this.seededProductId();
    const cartId = await owner.api.carts.create();
    await owner.api.carts.addItem(cartId, productId);

    const { address } = owner.user;
    const input: InvoiceInput = {
      cart_id: cartId,
      payment_method: 'cash-on-delivery',
      payment_details: {},
      billing_street: address.street ?? '',
      billing_city: address.city ?? '',
      billing_state: address.state ?? '',
      billing_country: address.country ?? '',
      billing_postal_code: address.postal_code ?? '',
    };
    const { id, invoice_number: invoiceNumber } = await owner.api.invoices.create(input);
    return { owner, id, invoiceNumber, input };
  }

  async favorite(): Promise<OwnedFavorite> {
    const owner = await this.owner();
    const favorite = await owner.api.favorites.create(await this.seededProductId());
    return { owner, favorite };
  }

  async message(): Promise<OwnedMessage> {
    const owner = await this.owner();
    const message = await owner.api.messages.create(buildMessage());
    return { owner, message };
  }

  private async seededProductId(): Promise<string> {
    const { data } = await this.deps.api.products.list();
    const [product] = data;
    if (!product) throw new Error('The catalog is empty; has Toolshop been seeded?');
    return product.id;
  }
}
