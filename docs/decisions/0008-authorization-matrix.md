# 0008: Authorization rules as a data-driven matrix

**Status:** Accepted

## Context

Who may do what is the same question asked of many endpoints: anonymous, owner, another customer,
admin. Written as individual tests, that is over a hundred near-identical bodies, and a missing
case is invisible. Some of the answers are currently wrong in Toolshop, so the suite also has to
stay green while recording those defects honestly.

## Decision

Declare the rules as data and generate one test per actor per operation.

- `src/core/authorization` holds the generic part: types, expansion and the runner. It knows
  nothing about Toolshop. `src/app/authorization/matrix.ts` is the Toolshop table.
- A row states the **correct** behaviour. A defect is a `knownIssue` on that row, carrying the
  finding it belongs to and the wrong status seen today.
- `test.fail()` is applied after the request, and only if the status is the recorded one or an
  accepted one. Declared up front it would hide faults: a broken arrange step or a new `500` would
  count as the expected failure, and the test would stay green.
- A fixed defect turns the test red as an unexpected pass, which prompts removing the `knownIssue`.
- Statuses cannot prove everything, so a row can add `verify`. Refused writes read the resource
  back, and GraphQL rows read the body because refusals there are `200`.
- The runner needs an `authorizationContext` fixture by name, because Playwright reads fixture
  names from the test function's source.

The role tests in `tests/api/products.spec.ts` stay. They overlap the matrix's `DELETE /products`
rows, but they run in the default API suite while the matrix is opt-in, so they are not duplicates
in practice.

## Consequences

- Adding an operation is one table entry, and gaps are visible in one file.
- Each row arranges its own data, which costs a registration or two per test but keeps rows
  independent and parallel-safe.
- Matrix rows run only with `TEST_ENV=local`, because they write data and probe other accounts.
- Test locations in reports point at the core runner rather than a spec line. The title identifies
  the row instead.
