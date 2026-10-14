# Flaky tests

A flaky test is one that can pass and fail on the same code. This framework does not hide flaky
tests behind retries. Retries collect evidence, quarantine stops a known-unstable test from
blocking others while it is fixed, and a summary after every run keeps both visible.

## What the framework does

| Mechanism                | Where                                           | Effect                                                                                                                                  |
| ------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Retries in CI only       | `playwright.config.ts` (`retries: 2` when `CI`) | A failure is retried; locally a failure is a failure                                                                                    |
| Trace on first retry     | `trace: 'on-first-retry'`                       | Every retried failure has a trace, screenshot and video in the report and `test-results/`                                               |
| Flaky summary reporter   | `src/core/reporting`                            | Lists tests that passed only on retry, and every `@quarantine` test, in the console and the GitHub job summary                          |
| `@quarantine` tag        | Test `tag` option                               | Excluded from PR smoke runs, `test:*` scripts and nightly shards                                                                        |
| Nightly `quarantine` job | `.github/workflows/nightly.yml`                 | Runs quarantined tests on every browser with `continue-on-error`, so their results stay in the published report without failing the run |

The HTML report also marks flaky tests, and Playwright's `flaky` count appears in the run output.

## How flakiness is tracked

1. **Spot it.** The **Test stability** section of a nightly or PR job summary lists each flaky
   test with its project and location. The merged nightly report links to the trace of the failed
   attempt.
2. **Open an issue** with the [Flaky test](../.github/ISSUE_TEMPLATE/flaky-test.yml) form and the
   `flaky` label. Include the run links and what the trace shows. One issue per test; add later
   occurrences to the same issue.
3. **Fix it straight away if the cause is clear.** Most flakiness here has been one of:
   - an assertion that is not web-first;
   - data shared between tests;
   - a UI quirk, such as the contact form's Send button moving when a field blurs.
4. **Quarantine it if the fix will take longer** and it fails more than once in a week. Tag it
   and link the issue:

   ```ts
   test(
     'the cart badge updates after adding a product',
     {
       tag: ['@regression', '@quarantine'],
       annotation: { type: 'issue', description: 'https://github.com/<owner>/<repo>/issues/123' },
     },
     async ({ productDetailPage }) => {
       // ...
     },
   );
   ```

5. **Release it** by removing `@quarantine` once the nightly quarantine job has passed for a week
   (seven consecutive runs). Close the issue in the same PR.

Quarantine is a short-term state. The `flaky` label list is the backlog, and an issue open longer
than a month needs a decision: fix the test, rewrite it, or delete it as low-value.

## Running quarantined tests

```bash
npm run test:quarantine          # only @quarantine tests; passes when there are none
npm run test:smoke               # @smoke minus @quarantine (what PRs run)
npx playwright test --repeat-each=10 --grep "<title>"   # reproduce locally
```

`npm test` runs everything, quarantined tests included, so local runs still show them.

## Current state

No tests are quarantined. The Redis cache in `docker-compose.yml` fixed the intermittent 401s seen
during Phase 1–2 ([ADR 0005](decisions/0005-toolshop-in-ci-via-docker-compose.md)). The full suite
passed in repeated runs (`--repeat-each=3`) with no flaky results.
