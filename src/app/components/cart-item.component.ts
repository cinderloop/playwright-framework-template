import type { Locator } from '@playwright/test';

/** One line in the cart table. */
export class CartItem {
  readonly title: Locator;
  readonly quantity: Locator;
  readonly unitPrice: Locator;
  readonly linePrice: Locator;

  constructor(readonly root: Locator) {
    this.title = root.getByTestId('product-title');
    this.quantity = root.getByRole('spinbutton', { name: /^Quantity for/ });
    this.unitPrice = root.getByTestId('product-price');
    this.linePrice = root.getByTestId('line-price');
  }
}
