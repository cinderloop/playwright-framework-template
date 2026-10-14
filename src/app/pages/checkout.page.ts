import type { Locator, Page } from '@playwright/test';
import type { PaymentMethod } from '@app/schemas';
import { CartPage } from './cart.page';

export interface BillingAddressInput {
  /** ISO 3166-1 alpha-2 code, the value of the country option. */
  country: string;
  postcode: string;
  houseNumber: string;
}

/**
 * The four-step checkout wizard at /checkout: cart, sign-in, billing address,
 * payment. Step 1 is the cart page itself.
 */
export class CheckoutPage {
  readonly cart: CartPage;
  readonly signedInMessage: Locator;
  readonly country: Locator;
  readonly postcode: Locator;
  readonly houseNumber: Locator;
  readonly street: Locator;
  readonly city: Locator;
  readonly state: Locator;
  readonly paymentMethod: Locator;
  readonly paymentSuccess: Locator;
  readonly orderConfirmation: Locator;
  private readonly finishButton: Locator;

  constructor(private readonly page: Page) {
    this.cart = new CartPage(page);
    this.signedInMessage = page.getByText(/you are already logged in/);
    this.country = page.getByLabel('Country');
    this.postcode = page.getByLabel('Postal code');
    this.houseNumber = page.getByLabel('House number');
    this.street = page.getByLabel('Street');
    this.city = page.getByLabel('City');
    this.state = page.getByLabel('State');
    this.paymentMethod = page.getByLabel('Payment Method');
    this.paymentSuccess = page.getByText('Payment was successful');
    this.orderConfirmation = page.getByText(/^Thanks for your order!/);
    this.finishButton = page.getByTestId('finish');
  }

  async proceedFromCart(): Promise<void> {
    await this.page.getByTestId('proceed-1').click();
  }

  async proceedAsSignedInCustomer(): Promise<void> {
    await this.page.getByTestId('proceed-2').click();
  }

  /** Street, city and state are filled in by the app's postcode lookup. */
  async enterBillingAddress({
    country,
    postcode,
    houseNumber,
  }: BillingAddressInput): Promise<void> {
    await this.country.selectOption(country);
    await this.postcode.fill(postcode);
    await this.houseNumber.fill(houseNumber);
  }

  async proceedFromBillingAddress(): Promise<void> {
    await this.page.getByTestId('proceed-3').click();
  }

  /** First click of the finish button: validates the payment details. */
  async checkPayment(method: PaymentMethod): Promise<void> {
    await this.paymentMethod.selectOption(method);
    await this.finishButton.click();
  }

  /** Second click of the finish button: places the order. */
  async confirmOrder(): Promise<void> {
    await this.finishButton.click();
  }

  /** Reads the invoice number from the confirmation message. */
  async invoiceNumber(): Promise<string> {
    const text = (await this.orderConfirmation.textContent()) ?? '';
    const match = /INV-\d+/.exec(text);
    if (!match) {
      throw new Error(`No invoice number in confirmation: "${text}"`);
    }
    return match[0];
  }
}
