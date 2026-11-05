# 0010: Compare live responses with the spec using a purpose-built comparison

**Status:** Accepted

## Context

The framework's Zod schemas, the Toolshop OpenAPI spec and the running API can each drift from the
others. Two approaches were on the table:

1. Export the Zod schemas to JSON Schema (Zod 4 can) and compare them with the spec.
2. Validate live responses against the spec with a JSON Schema validator such as Ajv.

The spec settled it. None of its component response schemas declare `required`, and it has one
`additionalProperties` in total. A validator asks "is this value allowed?", and with those rules
almost anything is, so it would pass a response with undocumented fields or missing documented ones,
which is most of the real drift. Comparing Zod to the spec has a different blind spot: it compares two
descriptions and never looks at the API, and Zod's stripping of unknown keys hides fields the
framework does not use.

## Decision

Compare real responses with the spec using a small comparison in `src/core/contract`. It asks "does
the documentation describe this value?" and reports undocumented fields, documented fields that are
absent, type mismatches, and undocumented status codes.

- `npm run check:openapi` runs as a `contract` Playwright project, so it can use real fixtures. Many
  responses only exist after a checkout, and the fixtures already know how to create one.
- It covers the operations the framework relies on (`src/app/contract/operations.ts`), including
  error responses.
- `src/app/contract/openapi.lock.json` stores the spec's hash. After reviewing a changed spec,
  `npm run check:openapi:update` records the new one.
- Nightly runs it automatically, because that job runs every project. PR runs do not.

Only two things fail the check, because only they need a person to act:

- **The spec changed** from the reviewed one, e.g. after Renovate bumps the Toolshop image.
- **A response breaks a framework schema**, because that breaks the framework's own tests.

Drift between the spec and the API is a finding about Toolshop, so it is reported and does not fail.

## Consequences

- No new dependency, at the cost of owning about a hundred lines, covered by unit tests. It supports
  the schema features this spec uses, not all of JSON Schema.
- Only operations in the table are compared, and each from one sample, so a field that appears only
  in some states can be reported either way. The report was identical across repeated runs.
- A broken schema that the test's setup also uses fails during setup, before the report is written.
  The run is still red, but with less information.
- Reported drift has no baseline, so a new mismatch appears in the report without failing anything.
  Someone has to read it. Nightly writes it to the job summary to make that easy.
