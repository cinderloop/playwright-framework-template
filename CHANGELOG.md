# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `src/core/api`: `BaseApiClient` over `APIRequestContext` with bearer-token handling, status
  checks and Zod response parsing; raw `*Response` methods for negative tests.
- `src/core/matchers`: async `toMatchSchema` matcher for values and `APIResponse` bodies.
- `src/core/data` and `CleanupQueue`: factory helper and LIFO teardown that always runs.
- Toolshop API clients and Zod schemas for auth, users, products, images, categories, brands,
  carts, invoices and postcode lookup.
- `testData` fixture: Faker-built entities created via the API and deleted after each test;
  order-referenced data is retained and annotated.
- 30 API tests (`api` project, no browser) and 4 hybrid e2e tests, including a full checkout.
- Checkout and invoices page objects; `signInWithToken` for customers created by a test.

- `pr.yml`: lint, format, typecheck and boundary checks plus `@smoke` tests against Toolshop in
  Docker Compose on every pull request and push to `main`.
- `nightly.yml`: scheduled and manual full suite across all browsers in 4 shards, blob reports
  merged with `playwright merge-reports` and published to GitHub Pages.
- Composite actions for Node/Playwright setup (npm and browser caching) and starting Toolshop.
- Blob reporter in CI; traces, screenshots and videos uploaded on failure.

### Changed

- Local and CI Toolshop use a pinned Redis cache, fixing intermittent 401s under parallel load.
- PR smoke runs include the `api` project.
- Toolshop images are pinned by digest. The API is fronted by the official multi-arch nginx
  image with a repo-owned config, replacing the arm64-only upstream `web` image.
- `typecheck:core` split out of `typecheck`; `toolshop:up` waits up to 5 minutes for health.

- Project scaffold: TypeScript (strict), path aliases `@core/*` and `@app/*`, ESLint with
  `eslint-plugin-playwright` and a lint-enforced core/app boundary, Prettier, Husky + lint-staged.
- Zod-validated configuration selected by `TEST_ENV` (`local`, `public`) that fails fast.
- Playwright config with Chromium, Firefox, WebKit and Pixel 7 projects, a health-check and
  per-role API auth setup project, CI-only retries and failure artifacts.
- Page objects and components for product listing, search and filters, product detail, cart,
  login, account and admin dashboard.
- 12 UI tests: browsing, search, filtering, sorting, cart, login and role-based access.
- `docker-compose.yml` for a local Toolshop with healthchecks and a seed script, and a
  `Dockerfile` that runs the suite in the official Playwright image.
