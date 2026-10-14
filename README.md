# Playwright Toolshop Framework

[![PR checks](https://github.com/cinderloop/playwright-framework-template/actions/workflows/pr.yml/badge.svg)](https://github.com/cinderloop/playwright-framework-template/actions/workflows/pr.yml)
[![Nightly](https://github.com/cinderloop/playwright-framework-template/actions/workflows/nightly.yml/badge.svg)](https://github.com/cinderloop/playwright-framework-template/actions/workflows/nightly.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Playwright](https://img.shields.io/github/package-json/dependency-version/cinderloop/playwright-framework-template/dev/@playwright/test?logo=playwright&label=Playwright)](https://playwright.dev)

**Latest nightly report:** https://cinderloop.github.io/playwright-framework-template/

A production-grade Playwright + TypeScript test automation framework. It is demonstrated against
[Practice Software Testing (Toolshop)](https://practicesoftwaretesting.com) and built to be reused
as a GitHub template for other applications.

## Features

- **Lint-enforced core/app boundary.** `src/core` is reusable and knows nothing about Toolshop;
  ESLint and a separate tsconfig keep it that way.
- **Fixtures, not base classes.** Page objects, API clients, test data and sessions are injected
  with `test.extend` and `mergeTests`.
- **Typed configuration.** It is selected by `TEST_ENV` and validated with Zod, so a bad value
  stops the run before a browser opens.
- **API testing.** A typed `BaseApiClient` parses every response through a Zod schema, and
  `toMatchSchema` asserts response contracts.
- **Fast, self-cleaning setup.** Login goes through the API in a setup project, and per-test data
  is created through the API and always deleted.
- **Test layers:** UI, API, hybrid e2e (including a full checkout), network mocking and HAR
  replay, the Clock API, axe accessibility scans with a rule baseline, ARIA snapshots, and visual
  regression in Docker.
- **Browsers:** Chromium, Firefox, WebKit and Pixel 7.
- **CI on GitHub Actions:**
  - PR checks: lint, format, typecheck, the boundary check, the Docker image tag and `@smoke`.
  - Nightly: the full suite in 4 shards plus a Docker visual job, with a merged report on GitHub
    Pages.
- **Flaky-test handling.** CI retries a failing test with a trace, `@quarantine` keeps known
  flaky tests out of blocking runs, and a stability summary is added to every job.
- **Optional extras:** Allure reports, Renovate dependency updates, and the Playwright test agents
  (planner, generator, healer) for Claude Code.

## Quick start

Requirements: Node.js 22+ (24 LTS recommended, see `.nvmrc`) and Docker.

```bash
npm ci
npx playwright install --with-deps
cp .env.example .env          # fill in the accounts below
npm run toolshop:start        # Toolshop in Docker: UI :4200, API :8091, seeded
npm test
```

The local stack uses Toolshop's seeded
[demo accounts](https://github.com/testsmith-io/practice-software-testing#default-accounts). Put a
customer and the admin account in `.env`.

**In Docker** (no local browsers needed, and the way to run WebKit on hosts where it is
unsupported):

```bash
npm run toolshop:start
npm run test:docker           # builds the Playwright image and runs the suite over host networking
```

**Against the hosted demo:** `TEST_ENV=public npm run test:smoke`. That environment is shared, so
keep runs small. Demo accounts there are sometimes locked by other users; if so, point
`CUSTOMER_EMAIL` at another seeded account.

## Project structure

```
src/core/        reusable framework code, knows nothing about Toolshop (lint-enforced)
  api/           BaseApiClient: typed requests on APIRequestContext, bearer token, Zod parsing
  matchers/      expect.toMatchSchema(schema), for values or APIResponse bodies
  a11y/          axe-core scan with a known-violation baseline
  reporting/     flaky/quarantine summary reporter
  fixtures/      base test: uniqueId, cleanup
  config/ auth/ data/ utils/
src/app/         Toolshop-specific code
  api/           one client per resource (auth, products, categories, brands, carts, invoices, ...)
  schemas/       Zod response schemas; types are inferred from them
  data/          Faker builders and TestData (create via API, delete after the test)
  pages/ components/ fixtures/ config/ auth/ a11y/
tests/
  setup/         health check and per-role auth (storage state via the API)
  api/           API tests (no browser)
  ui/            UI tests, including network mocking, HAR replay and the Clock API
  e2e/           hybrid tests: arrange via API, act and verify in the UI, clean up via API
  a11y/          axe scans against a rule baseline, ARIA snapshots
  visual/        screenshot baselines (Playwright Docker image only)
  agents/        seed test for the Playwright test agents
specs/           test plans written by the planner agent
docs/            architecture, adapting guide, flaky tests, AI-assisted testing, ADRs
```

`src/core` may never import from `src/app` or `tests`. See
[docs/architecture.md](docs/architecture.md) for how the layers, fixtures, auth, data and CI fit
together.

## Test layers

| Layer          | Project(s)             | Tests | What it covers                                                                                                 |
| -------------- | ---------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `tests/api`    | `api` (no browser)     | 30    | Auth, products, categories, brands, cart, invoices: happy paths, 422/409 validation, 401/403, 404s, pagination |
| `tests/ui`     | every browser project  | 23    | Browsing, search, filters, cart, login, role access, contact form; mocked API failures, HAR replay, Clock API  |
| `tests/e2e`    | every browser project  | 4     | API-created data verified in the UI, including a full checkout by a newly registered customer                  |
| `tests/a11y`   | `a11y` (Chromium)      | 10    | axe-core WCAG 2.1 AA scans of six pages against a rule baseline; ARIA snapshots of key components              |
| `tests/visual` | `visual` (Docker only) | 4     | Screenshot comparison of stable components                                                                     |

UI and e2e specs run on Chromium, Firefox, WebKit and Pixel 7. Counts are per browser. The HAR
re-record test runs only with `npm run test:har:update`.

**Test data.** Tests create their own data through `testData`, using Faker-built payloads that are
unique per test. The data is deleted through the API when the test ends, even when it fails.
Toolshop cannot delete some data:

- orders, and therefore any customer or product an order references;
- contact messages.

That data is kept and recorded on the test as a `retained-data` annotation. CI starts every run
from a freshly seeded database, and `npm run toolshop:seed` resets a local one.

### Advanced coverage

**Network mocking** (`tests/ui/network`). `page.route` replaces Toolshop API responses to reach
states a healthy backend will not produce on demand:

- an empty catalog;
- a 500 from the product API and from add-to-cart;
- a slow product API.

Slow responses are simulated by holding the request until the test has checked the loading state
(`holdRequests` in `src/core/utils`), not with timers. One scenario replays the product API from a
recorded HAR. Re-record it against a freshly seeded local stack with `npm run test:har:update`.

**Accessibility** (`tests/a11y`). Each key page is scanned with axe-core for WCAG 2.1 A/AA.
[`src/app/a11y/baseline.ts`](src/app/a11y/baseline.ts) lists known failures per page, each with a
reason:

- a scan fails on any rule not in the baseline;
- baseline rules that stopped failing are annotated, so the list only shrinks;
- the full axe output is attached to every test.

ARIA snapshots (`toMatchAriaSnapshot`) pin the accessibility tree of the main menu, sort control,
login form, checkout steps and cart table.

**Visual regression** (`tests/visual`). `toHaveScreenshot` covers the login form, the guest
header, a product detail page and the cart table, all from seeded data.

- Floating widgets and the footer build stamp are hidden by `tests/visual/screenshot.css`, and
  related products are masked.
- Baselines are generated and compared only inside the official Playwright image, so rendering is
  identical on every machine.
- That image is the `Dockerfile`, pinned to the `@playwright/test` version and checked by
  `npm run check:docker-image` in CI.
- Outside the image, the visual tests are skipped. Nightly CI runs them in the image.
- [ADR 0004](docs/decisions/0004-docker-based-visual-baselines.md) explains why.

To update baselines after an intended UI change:

1. Start and seed Toolshop: `npm run toolshop:start`.
2. Run `npm run test:visual:update`. It builds the image and writes new PNGs to
   `tests/visual/__screenshots__/`.
3. Review the image diffs in the pull request, then commit them with the change.
4. When upgrading Playwright, update the `Dockerfile` tag in the same PR and regenerate all
   baselines. Renovate groups the two updates into one PR.

**Clock API** (`tests/ui/checkout/card-expiry.spec.ts`). The payment step uses the browser clock
to reject card expiry dates before the current month.

- `page.clock` pins the date to 15 March 2031. February is rejected and March accepted.
- The clock then moves into April, and the same card is rejected as expired.
- The test runs as a guest. With the clock years ahead, a signed-in session's JWT would look
  expired to the app.

## Running subsets

Specs are tagged with the `tag` option: `@smoke`, `@regression`, `@api`, `@a11y`, `@visual` and
`@quarantine`. The health and auth setup tests are untagged and always run first as project
dependencies.

| Script                                    | Purpose                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `npm test`                                | Everything, all projects                                                |
| `npm run test:smoke`                      | `@smoke` tests (what PRs run), excluding `@quarantine`                  |
| `npm run test:regression`                 | `@regression` UI and e2e tests                                          |
| `npm run test:api` / `test:a11y`          | API tests / accessibility tests                                         |
| `npm run test:quarantine`                 | Only `@quarantine` tests                                                |
| `npm run test:ui` / `test:headed`         | Playwright UI mode / headed run                                         |
| `npm run test:docker`                     | Whole suite inside the official Playwright image (incl. WebKit, visual) |
| `npm run test:visual`                     | Visual tests in the Playwright image                                    |
| `npm run test:visual:update`              | Regenerate visual baselines in the Playwright image                     |
| `npm run test:har:update`                 | Re-record the product API HAR (local Toolshop)                          |
| `npm run test:allure`                     | Run with Allure results enabled (`ALLURE=1`)                            |
| `npm run report`                          | Open the last HTML report                                               |
| `npm run allure:generate` / `allure:open` | Build / open the Allure report from `allure-results/`                   |
| `npm run lint` / `lint:fix`               | ESLint (zero warnings) / ESLint with autofix                            |
| `npm run lint:boundary`                   | ESLint on `src/core` only (the core/app boundary)                       |
| `npm run typecheck` / `typecheck:core`    | `tsc` for the whole repo / for `src/core` alone                         |
| `npm run format` / `format:check`         | Prettier                                                                |
| `npm run check:docker-image`              | Dockerfile image tag matches `@playwright/test`                         |
| `npm run docker:build`                    | Build the test image (`toolshop-tests`) without running it              |
| `npm run toolshop:start`                  | Start Toolshop and seed it (`up` + `seed`)                              |
| `npm run toolshop:seed`                   | Reset Toolshop data: `php artisan migrate:fresh --seed`                 |
| `npm run toolshop:down`                   | Stop Toolshop and delete its volumes                                    |

Pass extra Playwright options after `--`, e.g. `npm run test:smoke -- --project=firefox`.

## Reporting

- **HTML report:** written on every run (`npm run report`). The nightly merges every shard and the
  Docker visual job into one report and publishes it to
  [GitHub Pages](https://cinderloop.github.io/playwright-framework-template/).
- **Test stability summary:** written after every run to the console and, in CI, to the job
  summary. It lists tests that only passed on retry and every quarantined test. See
  [docs/flaky-tests.md](docs/flaky-tests.md) for how flakiness is tracked.
- **Allure (optional):** `npm run test:allure`, then `npm run allure:generate` and
  `npm run allure:open`. It is off by default, so normal runs write only the HTML report. It uses
  Allure 3, which needs no Java.

## Continuous integration

| Workflow                                 | Trigger                      | What it does                                                                                                                                                 |
| ---------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [PR checks](.github/workflows/pr.yml)    | pull request, push to `main` | Lint, format, typecheck, core/app boundary, Docker image tag; `@smoke` (minus `@quarantine`) on API, Chromium and Pixel 7 against Toolshop in Docker Compose |
| [Nightly](.github/workflows/nightly.yml) | 02:00 UTC daily, manual      | Full suite on every browser in 4 shards, visual tests in the Playwright image, quarantined tests (non-blocking); one merged report published to GitHub Pages |

What every workflow does:

- **Toolshop:** each test job starts it from `docker-compose.yml`, waits for every service to be
  healthy and seeds the database. It runs the tests, then tears the stack down.
- **Artifacts:** the HTML report is uploaded on every run, and `test-results/` (traces,
  screenshots, videos) on failure.
- **Caching:** npm packages and Playwright browsers are cached.
- **Concurrency:** a newer run on the same branch or PR cancels the older one.
- **Pinning:** third-party actions are pinned to commit SHAs.

## AI-assisted test authoring (optional)

The Playwright test agents (planner, generator, healer) are set up for Claude Code. With Toolshop
running, open Claude Code in this repository and ask for an agent by name, for example: "Use the
playwright-test-planner agent to plan tests for the registration page, using project 'agents' and
seed `tests/agents/seed.spec.ts`". Treat what they produce as a draft. The agents get app behaviour
wrong at times, and the generated code needs rewriting onto the page objects.
[docs/ai-assisted-testing.md](docs/ai-assisted-testing.md) covers the setup, a worked example and
what review changed.

## Contributing

- **Pre-commit hook:** Husky runs ESLint and Prettier on staged files (lint-staged), then both
  typechecks, so a commit cannot break lint or types. It is installed by `npm ci`.
- **Pull requests:** they use the template in `.github/PULL_REQUEST_TEMPLATE.md` and must pass the
  PR checks. Record user-facing changes in [CHANGELOG.md](CHANGELOG.md) (Keep a Changelog).
- **Issues:** use the forms for framework bugs and flaky tests. Bugs in Toolshop itself belong in
  [its repository](https://github.com/testsmith-io/practice-software-testing/issues).
- **Commits:** follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `chore:`).

## Environment variables

They are documented in [.env.example](.env.example) and validated with Zod at start-up. An
invalid or missing value stops the run before any browser starts.

| Variable                              | Required | Description                                       |
| ------------------------------------- | -------- | ------------------------------------------------- |
| `TEST_ENV`                            | no       | `local` (default) or `public`                     |
| `BASE_URL`, `API_URL`                 | no       | Override the per-environment UI/API URLs          |
| `CUSTOMER_EMAIL`, `CUSTOMER_PASSWORD` | yes      | Account used for the customer role                |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`       | yes      | Account used for the admin role                   |
| `ALLURE`                              | no       | Set to `1` to also write Allure results           |
| `PW_AGENTS`                           | no       | Set by `.mcp.json`; adds the agents' seed project |

## Documentation

- [Architecture](docs/architecture.md): the core/app boundary, fixture composition, auth, data
  and CI flow.
- [Adapting to your app](docs/adapting-to-your-app.md): use this as a template; add a page object,
  an API client, a role or an environment.
- [Flaky tests](docs/flaky-tests.md): retries, quarantine and how flakiness is tracked.
- [AI-assisted testing](docs/ai-assisted-testing.md): the Playwright planner, generator and healer
  agents, what they produced, and what review changed.
- [Decisions](docs/decisions/): ADRs for fixtures, API auth, Zod, Docker visual baselines, Toolshop
  in Compose and Renovate.
- [Changelog](CHANGELOG.md)

## License

[MIT](LICENSE)
