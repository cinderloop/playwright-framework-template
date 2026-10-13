import type { Locator, Page } from '@playwright/test';

/** Bootstrap `navbar-expand-lg`: below this width the menu sits behind a toggle button. */
const COLLAPSE_BELOW_PX = 992;

/** The site header: main menu, cart badge and signed-in user menu. */
export class NavBar {
  readonly root: Locator;
  readonly toggle: Locator;
  readonly signInLink: Locator;
  readonly userMenu: Locator;
  readonly cartLink: Locator;
  readonly cartQuantity: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByRole('navigation').filter({
      has: page.getByRole('link', { name: 'Practice Software Testing - Toolshop' }),
    });
    this.toggle = this.root.getByRole('button', { name: 'Toggle navigation' });
    this.signInLink = this.root.getByTestId('nav-sign-in');
    this.userMenu = this.root.getByTestId('nav-menu');
    this.cartLink = this.root.getByRole('link', { name: 'cart' });
    this.cartQuantity = this.root.getByTestId('cart-quantity');
  }

  /** On narrow viewports the menu is collapsed; open it so its items can be used. */
  async expand(): Promise<void> {
    const width = this.page.viewportSize()?.width ?? Number.POSITIVE_INFINITY;
    if (width < COLLAPSE_BELOW_PX && (await this.toggle.getAttribute('aria-expanded')) !== 'true') {
      await this.toggle.click();
    }
  }

  async openCart(): Promise<void> {
    await this.expand();
    await this.cartLink.click();
  }
}
