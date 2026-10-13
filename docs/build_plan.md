# Build Prompt: Playwright Test Automation Framework (Toolshop)

## Role

You are a principal SDET and TypeScript engineer. You are building a production-grade, open-source Playwright test automation framework that serves two purposes at once:

1. A portfolio project that demonstrates expert-level test architecture against a real application.
2. A reusable starter that other engineers can adopt for their own applications via a GitHub template repository.

Every decision must be deliberate and explainable. Prefer clarity over cleverness. Do not add abstraction that Playwright already provides.

## Application under test

**Practice Software Testing (Toolshop)**

- Public site: https://practicesoftwaretesting.com
- API docs (Swagger): https://api.practicesoftwaretesting.com/api/documentation
- Source (for local/CI Docker runs): https://github.com/testsmith-io/practice-software-testing

Before writing code, read the Toolshop repository README to confirm: how to run it with Docker Compose, how to seed the database, the local UI and API ports, and the demo user accounts and roles. Do not rely on assumptions about credentials, ports or endpoints; verify them from the repo and the Swagger docs.

## Ground rules

- Use the latest stable Playwright and Node.js LTS. Check the installed Playwright version and its official docs before using any API; never invent APIs or config options.
- TypeScript in `strict` mode, ES modules, path aliases (`@core/*`, `@app/*`).
- npm as the package manager, with a committed lockfile.
- Work in phases (below). After each phase: run lint, typecheck and the test suite, fix all failures, then commit using Conventional Commits. Do not move to the next phase with anything red.
- If something is ambiguous or blocked (e.g. Toolshop's Docker setup fails), stop and explain the issue and options rather than guessing.

## Architecture: the core / app boundary

The framework has two layers. This boundary is the single most important design rule.

```
├── .github/
│   ├── workflows/            # pr.yml, nightly.yml, reports deploy
│   ├── dependabot.yml        # or renovate.json
│   └── ISSUE_TEMPLATE/, PULL_REQUEST_TEMPLATE.md
├── src/
│   ├── core/                 # REUSABLE: knows nothing about Toolshop
│   │   ├── config/           # Zod-validated, typed environment config
│   │   ├── api/              # base typed API client on APIRequestContext
│   │   ├── auth/             # generic storageState/role helpers
│   │   ├── fixtures/         # base test.extend composition
│   │   ├── data/             # generic factory/builder helpers
│   │   ├── matchers/         # custom expect matchers (e.g. toMatchSchema)
│   │   ├── reporting/        # reporter config helpers
│   │   └── utils/
│   └── app/                  # TOOLSHOP-SPECIFIC
│       ├── pages/            # page objects
│       ├── components/       # reusable UI components (nav, cart, product card)
│       ├── api/              # endpoint clients extending core client
│       ├── schemas/          # Zod response schemas
│       ├── data/             # builders/factories for Toolshop entities
│       └── fixtures/         # app fixtures extending core fixtures
├── tests/
│   ├── setup/                # auth setup projects per role
│   ├── ui/
│   ├── api/
│   ├── e2e/                  # hybrid API + UI flows
│   ├── a11y/
│   └── visual/
├── docs/
│   ├── architecture.md
│   ├── adapting-to-your-app.md
│   ├── ai-assisted-testing.md
│   └── decisions/            # lightweight ADRs
├── docker-compose.yml        # brings up Toolshop for local/CI runs
├── Dockerfile                # runs tests in the official Playwright image
├── .env.example
├── playwright.config.ts
├── LICENSE                   # MIT
├── CHANGELOG.md
└── README.md
```

**Enforce the boundary with tooling**, not just convention: configure ESLint (`import/no-restricted-paths`) or dependency-cruiser so that any import from `src/app` inside `src/core` fails lint. Add a CI step that runs this check.

## Coding standards (non-negotiable)

- **Locators:** user-facing only: `getByRole`, `getByLabel`, `getByText`, `getByTestId` (use the app's existing `data-test` attributes; set `testIdAttribute` in config if needed). No XPath. No brittle CSS chains.
- **Waiting:** web-first assertions only. Never `waitForTimeout`, never arbitrary sleeps, never `force: true` unless documented with a reason.
- **Fixtures over inheritance:** inject page objects, API clients, data factories and authenticated contexts via `test.extend`. No base test classes.
- **Page objects:** expose intent-level methods (`addToCart(product)`) and locators; keep assertions in tests, except for small reusable state checks clearly named as such.
- **Independence:** every test creates its own data and cleans up after itself. The suite must pass with `fullyParallel: true` and in random order.
- **Readability:** use `test.step` for multi-stage flows, descriptive test titles, and tags via the `tag` option (`@smoke`, `@regression`, `@api`, `@a11y`, `@visual`, `@quarantine`).
- **Types:** no `any`. API responses are parsed through Zod schemas, and types are inferred from the schemas (`z.infer`).
- **Secrets:** never committed. `.env` locally, GitHub Secrets in CI, `.env.example` documents every variable.

## Phases

### Phase 1: Foundation

- Project scaffold, TypeScript strict config, path aliases, ESLint (with `eslint-plugin-playwright` and the boundary rule), Prettier, Husky + lint-staged pre-commit.
- `src/core/config`: Zod-validated config that loads by `TEST_ENV` (local, public) and fails fast with a clear error on invalid or missing values. `local` targets Toolshop in Docker; `public` targets practicesoftwaretesting.com.
- `playwright.config.ts`: projects for Chromium, Firefox, WebKit and one mobile device; setup project dependencies; `retries` only in CI; `trace: 'on-first-retry'`, screenshot and video on failure; `forbidOnly` in CI; sensible timeouts.
- Auth setup projects that log in once per role (customer and admin) and save `storageState`, preferably via the API for speed, with one UI login test kept to cover the login flow itself.
- Core and app fixtures composed with `test.extend` / `mergeTests`.
- Page objects and components for: home/product listing, product detail, search and filters, cart, login.
- 8–12 UI tests covering: browsing, search, filtering, add to cart, cart quantity update, login success/failure, role-based access (admin area blocked for customers).
- `docker-compose.yml` that brings up Toolshop locally and a documented seed command.

### Phase 2: CI/CD and reporting

- `pr.yml`: on pull request, run lint, typecheck, boundary check and `@smoke` tests against Toolshop started via Docker Compose inside the workflow (wait for health, seed, run, tear down).
- `nightly.yml`: scheduled plus manual trigger, full suite sharded with a matrix, blob reports merged with `npx playwright merge-reports`.
- Publish the merged HTML report to GitHub Pages; link it and the CI status badge in the README.
- Upload traces as artifacts on failure.
- Cache npm dependencies and Playwright browsers appropriately.
- Concurrency control so superseded runs are cancelled.

### Phase 3: API and hybrid testing

- `src/core/api`: a base API client wrapping `APIRequestContext` with typed request helpers, auth token handling and response parsing through Zod.
- `src/core/matchers`: a custom `toMatchSchema` matcher.
- Toolshop API clients and schemas for: auth, products, categories, brands, cart, invoices/orders.
- API tests covering happy paths, validation errors, auth failures and pagination.
- Data factories using `@faker-js/faker` producing unique, valid data per test.
- Hybrid e2e tests: create data via API, act and verify via UI, clean up via API. Include a full checkout flow.

### Phase 4: Advanced coverage

- Network mocking with `page.route`: error states (500s), empty results, slow responses. Demonstrate HAR record/replay for one scenario.
- Accessibility: `@axe-core/playwright` scans on key pages with a documented rule baseline; ARIA snapshot assertions (`toMatchAriaSnapshot`) for key components.
- Visual regression with `toHaveScreenshot` on stable components, masking dynamic content. Generate and compare baselines only inside the official Playwright Docker image (version pinned to match `@playwright/test`), and document the `update-snapshots` workflow.
- Clock API for at least one time-dependent scenario, if the app has one; otherwise document why it was not applicable.

### Phase 5: Scale, reuse and polish

- Tag-based runs via npm scripts (`test:smoke`, `test:api`, `test:a11y`, etc.).
- Flaky test strategy: `@quarantine` tag excluded from PR runs, retries with traces, and a short doc on how flakiness is tracked.
- Optional Allure reporter alongside the HTML report, configured so it does not complicate local runs.
- Dependabot or Renovate configured for npm, GitHub Actions and Docker.
- AI-assisted testing: if the installed Playwright version supports test agents (planner, generator, healer) and/or the Playwright MCP server, set them up per the official docs. Document in `docs/ai-assisted-testing.md` exactly how they were used, what they produced, and where human review changed or rejected their output. If not supported, document that and skip.
- Mark the repository as a GitHub template (note this in the README as a manual step for the owner).

## Documentation requirements

- **README.md:** purpose, badges (CI, license, Playwright version), live report link, feature overview, quick start in under 5 minutes (local and Docker), project structure, available scripts, environment variables, and links to `docs/`.
- **docs/architecture.md:** the core/app boundary, fixture composition, auth strategy, data strategy, CI flow. Include a Mermaid diagram.
- **docs/adapting-to-your-app.md:** step-by-step guide for using this as a template: which folders to delete, which config to change, how to add a page object, an API client, a role and a new environment.
- **docs/decisions/:** short ADRs (context, decision, consequences) for at least: fixtures over inheritance, API-based auth setup, Zod for schema validation, Docker-based visual baselines, Toolshop in CI via Docker Compose.
- **CHANGELOG.md** following Keep a Changelog; tag `v1.0.0` when Phase 5 is complete.

## Definition of done

- `npm run lint`, `npm run typecheck` and the boundary check pass with zero warnings.
- The full suite passes locally against Docker Toolshop, three consecutive times, with `fullyParallel: true`.
- The PR and nightly workflows pass, and the report is published to GitHub Pages.
- No `waitForTimeout`, `any`, XPath, hardcoded credentials or committed secrets anywhere (verify with a search before finishing).
- Deleting `src/app` and `tests/` leaves `src/core` compiling with no errors.
- A reviewer can understand every major design choice from the docs alone.

## Final report

When finished, give a concise summary: what was built per phase, test counts by layer, any deviations from this plan and why, known limitations, and suggested next steps.
