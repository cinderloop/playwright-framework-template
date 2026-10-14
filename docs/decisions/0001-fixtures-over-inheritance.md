# 0001: Fixtures over inheritance

**Status:** Accepted

## Context

Tests need page objects, API clients, authenticated sessions, test data and cleanup. A common
approach is a `BaseTest` class that sets all of this up, and page classes that extend a
`BasePage`. That approach creates everything for every test whether it is needed or not, and it
hides setup order. Teardown also has to be hand-written in `afterEach`, where a failure in one
step can skip the rest.

Playwright's fixtures (`test.extend`) are lazy, composable, scoped (test or worker) and torn down
in reverse dependency order, even when the test fails.

## Decision

- Inject everything through fixtures. There are no base test classes and no `beforeEach` setup
  beyond navigation.
- `src/core/fixtures` defines framework fixtures (`uniqueId`, `cleanup`).
- `src/app/fixtures` defines one small fixture module per concern (config, api, data, pages) and
  combines them with `mergeTests`.
- Page objects are plain classes with locators and intent-level methods. They do not extend a base
  page.

## Consequences

- A test declares what it uses, `async ({ cartPage, testData }) => …`, and gets nothing else.
- Cleanup is reliable. `testData` depends on the API clients, so they are alive when it deletes
  data after a failed test.
- A new application adds its own fixture modules and merges them on top of the core. Nothing in
  `src/core` changes.
- Contributors need to know fixtures. That is standard Playwright, and the
  [architecture doc](../architecture.md#fixture-composition) shows the composition.
