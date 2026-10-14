# 0002: Log in through the API in a setup project

**Status:** Accepted

## Context

Most UI tests need a signed-in customer or admin. Logging in through the UI in every test is slow
and couples every test to the login page: one broken login form fails the whole suite. Toolshop
issues a JWT from `POST /users/login`, and the Angular app reads it from `localStorage`.

## Decision

- A `setup` project (`tests/setup/auth.setup.ts`) logs in each role through the API once per run.
  It writes a storage state (`.auth/<role>.json`) that puts the token in `localStorage`.
- Browser projects depend on `setup`, and specs choose a role with
  `test.use({ storageState: authFile(role) })`.
- Users that a test creates are signed in the same way with `signInWithToken`.
- The login UI keeps its own tests in `tests/ui/auth/login.spec.ts`.
- A `health` project runs first, so an unreachable Toolshop fails once with a clear message.

## Consequences

- Authentication takes milliseconds and no browser.
- The storage-state helpers in `src/core/auth` are generic: they take an origin and
  `localStorage` items. An app with cookie sessions can write `cookies` instead.
- Toolshop tokens last five minutes. In practice no single test needs one for longer, and API
  fixtures fetch fresh tokens per test.
- When the clock is moved years ahead (Clock API tests), stored tokens look expired to the app, so
  those tests run as a guest.
