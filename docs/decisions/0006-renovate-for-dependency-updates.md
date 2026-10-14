# 0006: Renovate rather than Dependabot

**Status:** Accepted

## Context

Dependencies come from three ecosystems: npm, GitHub Actions (pinned to SHAs) and Docker (the
Playwright image and digest-pinned Toolshop images). `@playwright/test` and the
`mcr.microsoft.com/playwright` image must be upgraded together, or `check:docker-image` fails and
visual baselines become invalid. Dependabot groups updates only within one ecosystem, so it would
open two PRs that each fail on their own.

## Decision

Use Renovate (`renovate.json`):

- One **Playwright** group covers the npm package and the Docker image. Its PR body reminds the
  author to regenerate visual baselines.
- **Toolshop images** need approval on the dependency dashboard.
- Lint/format tooling (minor and patch), Allure and GitHub Actions are each grouped.
- Action digests stay pinned (`helpers:pinGitHubActionDigests`).
- Updates run weekly before 06:00 UTC on Monday, wait 3 days after a release, and the lockfile
  gets monthly maintenance.

## Consequences

- One PR per coordinated upgrade instead of two broken ones.
- The repository owner must install the [Renovate GitHub app](https://github.com/apps/renovate)
  once. Without it the config does nothing. The README lists this as a manual setup step.
- The README's Playwright badge reads the version from `package.json`, so it needs no updates.
