import type { Locator, Page } from '@playwright/test';
import type { Credentials } from '@app/config';

export class LoginPage {
  readonly heading: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Login' });
    this.email = page.getByLabel(/^Email address/);
    // The password field is a custom component whose label is not linked to the input.
    this.password = page.getByTestId('password');
    this.submitButton = page.getByRole('button', { name: 'Login' });
    this.error = page.getByTestId('login-error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/auth/login');
  }

  async login({ email, password }: Credentials): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submitButton.click();
  }
}
