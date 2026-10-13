import type { Locator, Page } from '@playwright/test';
import { NavBar } from '@app/components/nav-bar.component';

/** Customer landing page after sign-in. */
export class AccountPage {
  readonly path = '/account';
  readonly nav: NavBar;
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.nav = new NavBar(page);
    this.heading = page.getByRole('heading', { level: 1, name: 'My account' });
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
