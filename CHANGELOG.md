# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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
