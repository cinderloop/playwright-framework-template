# Playwright Toolshop Framework

[![PR checks](https://github.com/cinderloop/playwright-framework-template/actions/workflows/pr.yml/badge.svg)](https://github.com/cinderloop/playwright-framework-template/actions/workflows/pr.yml)
[![Nightly](https://github.com/cinderloop/playwright-framework-template/actions/workflows/nightly.yml/badge.svg)](https://github.com/cinderloop/playwright-framework-template/actions/workflows/nightly.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Playwright](https://img.shields.io/badge/Playwright-1.64.0-2EAD33?logo=playwright)](https://playwright.dev)

**Latest nightly report:** https://cinderloop.github.io/playwright-framework-template/

A production-grade Playwright + TypeScript test automation framework, demonstrated against
[Practice Software Testing (Toolshop)](https://practicesoftwaretesting.com) and designed to be
reused as a template for other applications.

> Work in progress. Phases 1–4 (foundation, CI/CD and reporting, API and hybrid testing, advanced
> coverage) are complete; scale, reuse and full documentation follow. See [docs/build_plan.md](docs/build_plan.md).

## Quick start

Requirements: Node.js 22+ (24 LTS recommended, see `.nvmrc`) and Docker.

```bash
npm ci
npx playwright install --with-deps
cp .env.example .env          # then fill in the demo accounts from the Toolshop README
npm run toolshop:start        # Toolshop in Docker: UI :4200, API :8091, seeded
npm test
```

To run against the hosted demo instead: `TEST_ENV=public npm test`. That environment is shared
with everyone, so keep runs small; demo accounts there are sometimes locked by other users, in
which case point `CUSTOMER_EMAIL` at another seeded account.

### Running in Docker

`npm run test:docker` builds the official Playwright image (pinned to the same version as
`@playwright/test`) and runs the suite against the local Toolshop over host networking. This is
also the way to run WebKit on hosts where the native WebKit build is unsupported.

## Continuous integration

| Workflow                                 | Trigger                      | What it does                                                                                                                                 |
| ---------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [PR checks](.github/workflows/pr.yml)    | pull request, push to `main` | Lint, format, typecheck and the core/app boundary check; `@smoke` tests on Chromium and Pixel 7 against Toolshop started with Docker Compose |
| [Nightly](.github/workflows/nightly.yml) | 02:00 UTC daily, manual      | Full suite on every browser in 4 shards, blob reports merged into one HTML report and published to GitHub Pages                              |

Both workflows start Toolshop from `docker-compose.yml`, wait for every service to be healthy,
seed the database, run the tests and tear the stack down. The HTML report is uploaded as an
artifact on every run and `test-results/` (traces, screenshots, videos) on failure. npm
packages and Playwright browsers are cached; a newer run on the same branch or PR cancels the
older one. Third-party actions are pinned to commit SHAs.

One-time repository setup:

1. **Secrets** (Settings → Secrets and variables → Actions): `CUSTOMER_EMAIL`,
   `CUSTOMER_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`. Pull requests from forks do not
   receive secrets, so their smoke job fails at config validation; the static job still runs.
2. **Pages** (Settings → Pages): set Source to **GitHub Actions**. The report is published from
   `main` only.

## Project structure

```
src/core/        reusable framework code, knows nothing about Toolshop (lint-enforced)
  api/           BaseApiClient: typed requests on APIRequestContext, bearer token, Zod parsing
  matchers/      expect.toMatchSchema(schema), for values or APIResponse bodies
  a11y/          axe-core scan with a known-violation baseline
  fixtures/      base test: uniqueId, cleanup
  config/ auth/ data/ utils/
src/app/         Toolshop-specific code
  api/           one client per resource (auth, products, categories, brands, carts, invoices, ...)
  schemas/       Zod response schemas; types are inferred from them
  data/          faker builders and TestData (create via API, delete after the test)
  pages/ components/ fixtures/ config/ auth/
tests/
  setup/         health check and per-role auth (storage state via the API)
  api/           API tests (no browser)
  ui/            UI tests
  e2e/           hybrid tests: arrange via API, act and verify in the UI, clean up via API
  a11y/          axe scans against a rule baseline, ARIA snapshots
  visual/        screenshot baselines (Playwright Docker image only)
```

`src/core` may never import from `src/app` or `tests`. ESLint enforces this
(`import-x/no-restricted-paths` plus a `no-restricted-imports` pattern), and
`tsconfig.core.json` type-checks `src/core` on its own.

## Test layers and data

| Layer          | Runs in                       | What it covers                                                                                                                                |
| -------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/api`    | `api` project, no browser     | Auth, products, categories, brands, cart and invoices: happy paths, validation errors (422/409), auth failures (401/403), 404s and pagination |
| `tests/ui`     | every browser project         | Browsing, search, filters, cart, login, role-based access; API failures mocked with `page.route`, HAR replay, Clock API                       |
| `tests/e2e`    | every browser project         | API-created data verified in the UI, including a full checkout by a newly registered customer                                                 |
| `tests/a11y`   | `a11y` project (Chromium)     | axe-core WCAG 2.1 AA scans of six pages against a rule baseline; ARIA snapshots of key components                                             |
| `tests/visual` | `visual` project, Docker only | Screenshot comparison of stable components                                                                                                    |

Tests create their own data through `testData` (Faker-built payloads, unique per test) and it is
deleted through the API when the test ends, even when it fails. Toolshop has no API to delete
orders, so a customer or product that an order references cannot be deleted (409); that data is
kept and recorded on the test as a `retained-data` annotation. CI starts every run from a freshly
seeded database, and `npm run toolshop:seed` resets a local one.

The local stack runs Toolshop's cache on Redis rather than the image's default file cache. With
the file cache, every catalog write flushes the whole cache, including the cached auth user, so
parallel tests saw valid tokens intermittently rejected with 401.

## Advanced coverage

**Network mocking** (`tests/ui/network`). `page.route` replaces Toolshop API responses to reach
states a healthy backend will not produce on demand: an empty catalog, a 500 from the product API
and from add-to-cart, and a slow product API. Slow responses are simulated by holding the request
until the test has checked the loading state (`holdRequests` in `src/core/utils`), not with
timers. One scenario replays the product API from a recorded HAR; re-record it against a freshly
seeded local stack with `npm run test:har:update`.

**Accessibility** (`tests/a11y`). Each key page is scanned with axe-core for WCAG 2.1 A/AA. Known
failures are listed per page with a reason in
[`src/app/a11y/baseline.ts`](src/app/a11y/baseline.ts): a scan fails on any rule not in the
baseline, and annotates baseline rules that stopped failing so the list only shrinks. The full axe
output is attached to every test. ARIA snapshots (`toMatchAriaSnapshot`) pin the accessibility
tree of the main menu, sort control, login form, checkout steps and cart table.

**Visual regression** (`tests/visual`). `toHaveScreenshot` covers the login form, the guest
header, a product detail page and the cart table, all built from seeded data. Floating widgets and
the footer build stamp are hidden by `tests/visual/screenshot.css`, and related products are
masked. Baselines are generated and compared only inside the official Playwright image (the
`Dockerfile`, pinned to the `@playwright/test` version and checked by
`npm run check:docker-image` in CI), so rendering is identical on every machine; outside it the
visual tests are skipped. Nightly CI runs them in that image.

To update baselines after an intended UI change:

1. Start and seed Toolshop: `npm run toolshop:start`.
2. Run `npm run test:visual:update`. It builds the image and writes new PNGs to
   `tests/visual/__screenshots__/`.
3. Review the image diffs in the pull request, then commit them with the change.
4. When upgrading Playwright, update the `Dockerfile` tag in the same PR and regenerate all
   baselines.

**Clock API** (`tests/ui/checkout/card-expiry.spec.ts`). The payment step rejects card expiry
dates before the current month using the browser clock. `page.clock` pins the date to
15 March 2031 to check the boundary (February rejected, March accepted), then moves the clock
into April to show the same card expiring. It runs as a guest, because a signed-in session's JWT
would look expired to the app with the clock years ahead.

## Scripts

| Script                                 | Purpose                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `npm test`                             | Full suite, all browser projects                        |
| `npm run test:smoke`                   | `@smoke` tests only                                     |
| `npm run test:ui` / `test:headed`      | Playwright UI mode / headed run                         |
| `npm run test:docker`                  | Suite inside the official Playwright image              |
| `npm run test:visual`                  | Visual tests in the Playwright image                    |
| `npm run test:visual:update`           | Regenerate visual baselines in the Playwright image     |
| `npm run test:har:update`              | Re-record the product API HAR (local Toolshop)          |
| `npm run check:docker-image`           | Dockerfile image tag matches `@playwright/test`         |
| `npm run report`                       | Open the last HTML report                               |
| `npm run lint` / `lint:boundary`       | ESLint (zero warnings) / core-only boundary check       |
| `npm run typecheck` / `typecheck:core` | `tsc` for the whole repo / for `src/core` alone         |
| `npm run format` / `format:check`      | Prettier                                                |
| `npm run toolshop:start`               | Start Toolshop and seed it (`up` + `seed`)              |
| `npm run toolshop:seed`                | Reset Toolshop data: `php artisan migrate:fresh --seed` |
| `npm run toolshop:down`                | Stop Toolshop and delete its volumes                    |

## Environment variables

Documented in [.env.example](.env.example) and validated with Zod at start-up; an invalid or
missing value stops the run before any browser starts.

| Variable                              | Required | Description                              |
| ------------------------------------- | -------- | ---------------------------------------- |
| `TEST_ENV`                            | no       | `local` (default) or `public`            |
| `BASE_URL`, `API_URL`                 | no       | Override the per-environment UI/API URLs |
| `CUSTOMER_EMAIL`, `CUSTOMER_PASSWORD` | yes      | Account used for the customer role       |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`       | yes      | Account used for the admin role          |

## License

[MIT](LICENSE)
