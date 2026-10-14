import type { Locator, Page } from '@playwright/test';

export type ContactSubject =
  'Customer service' | 'Webmaster' | 'Return' | 'Payments' | 'Warranty' | 'Status of my order';

export interface ContactMessageInput {
  firstName: string;
  lastName: string;
  email: string;
  subject: ContactSubject;
  message: string;
}

/** The contact form at /contact, as a guest sees it (a signed-in user has no name or email fields). */
export class ContactPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly email: Locator;
  readonly subject: Locator;
  readonly message: Locator;
  readonly sendButton: Locator;
  readonly firstNameError: Locator;
  readonly lastNameError: Locator;
  readonly emailError: Locator;
  readonly subjectError: Locator;
  readonly messageError: Locator;
  readonly confirmation: Locator;

  constructor(private readonly page: Page) {
    this.firstName = page.getByLabel('First name');
    this.lastName = page.getByLabel('Last name');
    this.email = page.getByLabel('Email address');
    this.subject = page.getByLabel('Subject');
    this.message = page.getByLabel('Message');
    this.sendButton = page.getByRole('button', { name: 'Send' });
    this.firstNameError = page.getByTestId('first-name-error');
    this.lastNameError = page.getByTestId('last-name-error');
    this.emailError = page.getByTestId('email-error');
    this.subjectError = page.getByTestId('subject-error');
    this.messageError = page.getByTestId('message-error');
    this.confirmation = page.getByRole('alert').filter({ hasText: 'Thanks for your message!' });
  }

  async goto(): Promise<void> {
    await this.page.goto('/contact');
  }

  async fillForm({
    firstName,
    lastName,
    email,
    subject,
    message,
  }: ContactMessageInput): Promise<void> {
    await this.firstName.fill(firstName);
    await this.lastName.fill(lastName);
    await this.email.fill(email);
    await this.subject.selectOption({ label: subject });
    await this.enterMessage(message);
  }

  /**
   * The message is validated on blur, and the blur removes or adds its error
   * box, which moves the Send button. Clicking Send straight after typing can
   * therefore miss it, so the field is blurred first.
   */
  async enterMessage(message: string): Promise<void> {
    await this.message.fill(message);
    await this.message.blur();
  }

  async send(): Promise<void> {
    await this.sendButton.click();
  }
}
