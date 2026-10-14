# 0005: Toolshop in CI via Docker Compose

**Status:** Accepted

## Context

The hosted demo at practicesoftwaretesting.com is shared with everyone. Its data changes under
other users, demo accounts get locked, and heavy parallel runs against it are unfair to others.
Tests that create and delete data need an instance they own.

## Decision

- `docker-compose.yml` runs Toolshop (sprint 5 API and UI images, MariaDB, Redis and an nginx
  front for the API) locally and in CI.
- Images are pinned by digest. The upstream arm64-only web image is replaced by the official
  multi-arch nginx with a repo-owned config, so the same stack runs on Apple silicon and x86
  runners.
- The API cache uses Redis instead of the image's file cache. Under parallel load, the file cache's
  global flush on every catalog write intermittently invalidated the cached auth user and caused
  401s.
- Each CI job starts the stack, waits for every health check, seeds it
  (`php artisan migrate:fresh --seed`), runs tests and tears it down. The `start-toolshop`
  composite action holds these steps.
- `TEST_ENV=public` still targets the hosted demo for light, read-mostly runs.

## Consequences

- Every CI run starts from the same seeded data, and tests can create and delete freely.
- Startup adds a few minutes per job, mostly image pulls and migrations.
- Toolshop upgrades are deliberate. Renovate needs dashboard approval for its images, because a
  new image can change behaviour, accessibility results and screenshots.
