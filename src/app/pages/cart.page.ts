import type { Locator, Page } from '@playwright/test';
import { CartItem } from '@app/components/cart-item.component';
import { NavBar } from '@app/components/nav-bar.component';

/** Step 1 of checkout: the cart contents. */
export class CartPage {
  readonly nav: NavBar;
  readonly items: Locator;
  readonly total: Locator;
  readonly quantityUpdatedToast: Locator;
  readonly proceedButton: Locator;

  constructor(private readonly page: Page) {
    this.nav = new NavBar(page);
    this.items = page.getByRole('row').filter({ has: page.getByTestId('product-title') });
    this.total = page.getByTestId('cart-total');
    this.quantityUpdatedToast = page
      .getByRole('alert')
      .filter({ hasText: 'Product quantity updated.' });
    this.proceedButton = page.getByRole('button', { name: 'Proceed to checkout' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/checkout');
  }

  item(productName: string): CartItem {
    return new CartItem(this.items.filter({ hasText: productName }));
  }

  /** The cart saves a new quantity when the field changes, i.e. on blur. */
  async setQuantity(productName: string, quantity: number): Promise<void> {
    const { quantity: field } = this.item(productName);
    await field.fill(String(quantity));
    await field.blur();
  }
}
