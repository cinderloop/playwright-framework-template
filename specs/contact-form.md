# Toolshop Contact Form (Guest) Test Plan

## Application Overview

Test plan for the guest Contact form at /contact (http://localhost:4200), reached via the 'Contact' link in the main menu. The form has First name, Last name, Email address, Subject (select), Message (min 50 chars), optional txt Attachment, and a Send button. Scope is limited to the guest form: required-field validation, email and message-length validation, subject options, and successful submission. Every scenario assumes a fresh browser session, not signed in.

## Test Scenarios

### 1. Contact Form

**Seed:** `tests/agents/seed.spec.ts`

#### 1.1. Navigate to Contact page from main menu

**File:** `tests/contact-form/navigate-to-contact.spec.ts`

**Steps:**
  1. From the home page, click the 'Contact' link in the main menu.
    - expect: URL is /contact and the title contains 'Contact Us'
    - expect: Heading 'Contact' is visible
    - expect: First name, Last name, Email address, Subject, Message, Attachment and Send are visible
    - expect: All fields are empty and Subject shows 'Select a subject *'

#### 1.2. Required-field validation on empty submit

**File:** `tests/contact-form/required-fields.spec.ts`

**Steps:**
  1. Open /contact and click 'Send' without entering anything.
    - expect: 'First name is required' is shown
    - expect: 'Last name is required' is shown
    - expect: 'Email is required' is shown
    - expect: 'Subject is required' is shown
    - expect: 'Message is required' is shown
    - expect: No POST to /messages is made and the form stays on the page
  2. Fill only First name and click 'Send' again.
    - expect: The first-name error disappears
    - expect: The other four required errors remain

#### 1.3. Email format validation

**File:** `tests/contact-form/email-validation.spec.ts`

**Steps:**
  1. Fill all fields validly (Subject 'Webmaster', message of 50+ characters) but enter 'not-an-email' in Email, then click 'Send'.
    - expect: 'Email format is invalid' is shown
    - expect: The form is not submitted
  2. Repeat with 'user@', '@example.com' and 'user example.com'.
    - expect: Each value shows the email format error
  3. Replace the email with 'jane.doe@example.com' and click 'Send'.
    - expect: The email error disappears
    - expect: The form submits successfully

#### 1.4. Message minimum length validation

**File:** `tests/contact-form/message-length.spec.ts`

**Steps:**
  1. Fill all other fields validly and enter 'short' in Message, then click 'Send'.
    - expect: 'Message must be minimal 50 characters' is shown
    - expect: The form is not submitted
  2. Enter exactly 49 characters in Message and click 'Send'.
    - expect: The minimum-length error is still shown
  3. Enter exactly 50 characters in Message and click 'Send'.
    - expect: The message error is not shown
    - expect: The form submits successfully

#### 1.5. Subject dropdown options

**File:** `tests/contact-form/subject-options.spec.ts`

**Steps:**
  1. Open /contact and read the Subject options.
    - expect: Options in order: 'Select a subject *' (placeholder), 'Customer service', 'Webmaster', 'Return', 'Payments', 'Warranty', 'Status of my order'
  2. Leave the placeholder selected, fill all other fields validly, click 'Send'.
    - expect: 'Subject is required' is shown and nothing is submitted
  3. Select each real subject in turn.
    - expect: The selected value is displayed and the subject error clears

#### 1.6. Successful guest submission

**File:** `tests/contact-form/successful-submission.spec.ts`

**Steps:**
  1. Open /contact. Enter First name 'Jane', Last name 'Doe', Email 'jane.doe@example.com', Subject 'Webmaster', and a Message of at least 50 characters, e.g. 'This is a valid message that is definitely longer than fifty characters.'
    - expect: No validation errors are shown while filling
  2. Click 'Send'.
    - expect: A POST to /messages is sent
    - expect: The alert 'Thanks for your message! We will contact you shortly.' is shown
    - expect: The form is no longer displayed (or is reset), and no validation errors appear
