# Playwright Toolshop Framework

A production-grade Playwright + TypeScript test automation framework, demonstrated against
[Practice Software Testing (Toolshop)](https://practicesoftwaretesting.com) and designed to be
reused as a template for other applications.

> Work in progress. Phase 1 (foundation) is complete; CI, API/hybrid tests, accessibility,
> visual regression and full documentation follow. See [docs/build_plan.md](docs/build_plan.md).

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

## Project structure

```
src/core/   reusable framework code, knows nothing about Toolshop (lint-enforced)
src/app/    Toolshop-specific config, page objects, components, API helpers, fixtures
tests/      setup projects (health check, per-role auth) and specs
```

`src/core` may never import from `src/app` or `tests`. ESLint enforces this
(`import-x/no-restricted-paths` plus a `no-restricted-imports` pattern), and
`tsconfig.core.json` type-checks `src/core` on its own.

## Scripts

| Script                            | Purpose                                                 |
| --------------------------------- | ------------------------------------------------------- |
| `npm test`                        | Full suite, all browser projects                        |
| `npm run test:smoke`              | `@smoke` tests only                                     |
| `npm run test:ui` / `test:headed` | Playwright UI mode / headed run                         |
| `npm run test:docker`             | Suite inside the official Playwright image              |
| `npm run report`                  | Open the last HTML report                               |
| `npm run lint` / `lint:boundary`  | ESLint (zero warnings) / core-only boundary check       |
| `npm run typecheck`               | `tsc` for the whole repo and for `src/core` alone       |
| `npm run format` / `format:check` | Prettier                                                |
| `npm run toolshop:start`          | Start Toolshop and seed it (`up` + `seed`)              |
| `npm run toolshop:seed`           | Reset Toolshop data: `php artisan migrate:fresh --seed` |
| `npm run toolshop:down`           | Stop Toolshop and delete its volumes                    |

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
