import type { Locator, Page } from '@playwright/test';
import { NavBar } from '@app/components/nav-bar.component';

export class ProductDetailPage {
  readonly nav: NavBar;
  readonly name: Locator;
  readonly unitPrice: Locator;
  readonly description: Locator;
  readonly quantity: Locator;
  readonly addToCartButton: Locator;
  readonly addedToCartToast: Locator;
  readonly outOfStock: Locator;

  constructor(private readonly page: Page) {
    this.nav = new NavBar(page);
    this.name = page.getByRole('heading', { level: 1 });
    this.unitPrice = page.getByTestId('unit-price');
    this.description = page.getByTestId('product-description');
    this.quantity = page.getByRole('spinbutton', { name: 'Quantity' });
    this.addToCartButton = page.getByRole('button', { name: 'Add to cart' });
    this.addedToCartToast = page
      .getByRole('alert')
      .filter({ hasText: 'Product added to shopping cart.' });
    this.outOfStock = page.getByTestId('out-of-stock');
  }

  async goto(productId: string): Promise<void> {
    await this.page.goto(`/product/${productId}`);
  }

  async addToCart(quantity = 1): Promise<void> {
    await this.quantity.fill(String(quantity));
    await this.addToCartButton.click();
  }
}
