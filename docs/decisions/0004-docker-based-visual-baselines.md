# 0004: Visual baselines only in the Playwright Docker image

**Status:** Accepted

## Context

Screenshots differ across operating systems, font stacks, GPU settings and browser builds.
Baselines generated on a developer's Mac fail on Linux CI and the other way round. Keeping one set
per platform triples the review work and still drifts.

## Decision

- Generate and compare visual baselines only inside the official
  `mcr.microsoft.com/playwright:v<version>-noble` image (`Dockerfile`). Its tag is pinned to the
  installed `@playwright/test` version, and `npm run check:docker-image` enforces that in CI.
- The image sets `PLAYWRIGHT_DOCKER=1`. Visual tests skip anywhere else with a message.
- Baselines are Linux/Chromium only, so the platform suffix is left out of the snapshot path.
- Floating widgets and the footer build stamp are hidden with `screenshot.css`. Dynamic regions
  (related products) are masked.
- Update baselines with `npm run test:visual:update` and review the PNG diffs in the PR.
- Nightly CI runs the visual project in the image and merges its blob report with the others.

## Consequences

- One set of baselines is valid on every machine that has Docker.
- Visual tests are not part of the PR smoke run; they run nightly. A PR that changes the UI should
  regenerate baselines itself.
- A Playwright upgrade changes the image and so the browsers. The Dockerfile tag and the baselines
  must be updated in the same PR. Renovate groups the npm package and the image for this reason
  ([0006](0006-renovate-for-dependency-updates.md)).
