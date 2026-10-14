# 0003: Zod for config and response validation

**Status:** Accepted

## Context

Two kinds of untyped input reach the framework: environment variables and API responses. Writing
TypeScript interfaces for them by hand gives types that nothing checks at runtime. A renamed field
then surfaces as `undefined` deep in a test rather than as a clear failure.

## Decision

Use Zod (v4) as the single source of truth for both:

- `loadConfig` parses environment presets plus `.env` plus real variables through a schema. It
  throws a `ConfigError` that lists every invalid field before any browser starts.
- Every API client method that returns data parses the body through a schema
  (`BaseApiClient.parse`). Types are inferred with `z.infer` and never written separately.
- `expect(value | response).toMatchSchema(schema)` asserts response contracts in API tests and
  reports Zod's issue list on failure.

## Consequences

- An API contract change fails at the client with the exact path that broke, in every test that
  touches it.
- Schemas double as documentation of what the tests rely on. They are intentionally not a full copy
  of the API: they model only the fields the tests use.
- Zod is a runtime dependency of `src/core`. Any adopting project takes it on.
