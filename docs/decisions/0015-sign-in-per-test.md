# 0015: Sign in per test

**Status:** Accepted. Supersedes [ADR 0002](0002-api-based-auth-setup.md).

## Context

ADR 0002 logged each role in once per run, in a setup project, and stored the token for browser
tests. That assumed tokens outlast a run. Toolshop's last five minutes, and the advanced API suites
made full runs longer than that: browser tests started seven minutes in, found an expired token, and
failed on a page that needs a login. The failure only appeared in full runs, because a spec run on
its own always had a fresh token.

## Decision

Sign in per test, through the API, with the `signInAs` fixture:

```ts
test.beforeEach(({ signInAs }) => signInAs('admin'));
```

It logs in and puts the token in `localStorage` with `signInWithToken`, the way the Angular app
expects. The login UI keeps its own tests in `tests/ui/auth/login.spec.ts`. The setup project and the
storage-state helpers had no remaining use, so they were removed. The `health` project stays.

## Consequences

- A test's session cannot expire because of how long the run took.
- Each signed-in test pays for one API login, a few milliseconds of work on a warm stack.
- For an app whose sessions outlast a full run, a setup project with `storageState` is a reasonable
  choice and avoids that login. ADR 0002 records how it worked.
- Clock API tests still run as a guest: with the clock years ahead, any token looks expired to the app.
