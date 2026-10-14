import type { Locator, Page } from '@playwright/test';

/** The signed-in customer's order history at /account/invoices. */
export class InvoicesPage {
  readonly heading: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Invoices' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/account/invoices');
  }

  invoiceRow(invoiceNumber: string): Locator {
    return this.page.getByRole('row').filter({ hasText: invoiceNumber });
  }
}
