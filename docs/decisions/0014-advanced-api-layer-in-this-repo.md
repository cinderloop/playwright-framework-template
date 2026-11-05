# 0014: Keep the advanced API layer in this repository

**Status:** Accepted

## Context

This repository is a template and also a teaching example. Advanced API techniques such as
authorization matrices and property-based tests are useful to learn from, but most adopters will not
want them on day one. They also write data and probe other accounts, and some are slow, so they
cannot run everywhere the rest of the suite does. They could have lived in a separate repository.

## Decision

Keep them here, kept apart by three boundaries:

- **Folder:** Toolshop examples live in `tests/api/advanced` and `tests/contract`, so removing them is
  one delete. Reusable parts go in `src/core`, where every adopter benefits.
- **Tags:** suites are tagged `@api-advanced` or `@contract`. `npm run test:api` leaves them out, PRs
  do not run them, and nightly runs them in their own job.
- **Environment:** they call `localOnly`, so they skip unless `TEST_ENV=local`. The hosted demo is a
  shared service and must never receive this traffic.

## Consequences

- The techniques stay next to the code they use, and cannot fall out of step with it.
- PR feedback stays fast, but a regression in an advanced suite is only found nightly.
- The stack gained a `worker` service for them (ADR 0013), which every run now starts.
- The repository is larger for adopters who do not want this. The adapting guide lists what to delete.
