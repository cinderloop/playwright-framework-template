import type { Locator, Page } from '@playwright/test';

/** Admin landing page; only reachable with the admin role. */
export class AdminDashboardPage {
  readonly path = '/admin/dashboard';
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Sales over the years' });
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
