# 0007: Vitest for pure core functions

**Status:** Accepted

## Context

`src/core` now holds logic with many edge cases and no browser or API involved, such as redaction,
where a mistake leaks a credential into a report. Testing that through Playwright means starting
the Toolshop stack to check a string function, and it would not run in the PR job that has no
stack. The Playwright runner could run these without a browser, but `tests/` is split into projects
that depend on a health check against a live application.

## Decision

Use [Vitest](https://vitest.dev) for pure functions in `src/core`, run by `npm run test:unit` in
the PR static job.

- Files sit beside the code as `*.unit.test.ts`, so deleting `src/app` and `tests/` keeps them.
- Only pure logic is covered. Playwright glue (fixtures, `pollUntil`, the skip guards) is not unit
  tested, and is exercised by real test runs instead.
- `node:test` was the zero-dependency option, but has weaker assertions and TypeScript support
  given this repo's strict, path-aliased setup, and Jest would need a separate TypeScript
  transform. Vitest runs TypeScript directly.

## Consequences

- One more development dependency, updated by Renovate.
- Modules under test must not import `@playwright/test` at runtime, because its `expect` cannot
  load in the same process as Vitest's. This is why `environmentSkipReason` is separate from the
  guards, and why unit tests import modules directly rather than through the barrels.
