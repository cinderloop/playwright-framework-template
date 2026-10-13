import type { Locator } from '@playwright/test';

/** A product tile in the listing grid. */
export class ProductCard {
  readonly name: Locator;
  readonly price: Locator;

  constructor(readonly root: Locator) {
    this.name = root.getByTestId('product-name');
    this.price = root.getByTestId('product-price');
  }

  async open(): Promise<void> {
    await this.name.click();
  }
}
