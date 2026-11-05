# 0012: fast-check for property-based tests

**Status:** Accepted

## Context

Example-based tests only cover the inputs someone thought of. Some catalogue and validation rules
hold for every input: a page never exceeds its size, a sort holds on every page, a quantity outside
1 to 99 is always refused. Testing those needs generated input, and a failure needs to be repeatable
and reduced to something readable.

## Decision

Use [fast-check](https://fast-check.dev) for the property tests in `tests/api/advanced/`.

- It has TypeScript types, async properties and shrinking, and no runtime dependencies.
- `checkProperty` in `src/core/utils` wraps it. Each run costs real API calls, so runs are bounded (20
  by default). The seed is recorded as a `property-seed` annotation, and also appears in the failure.
- To repeat a failure, run the test with `PROPERTY_SEED=<seed>`. Failing inputs are replayed exactly.

Writing generators by hand would lose shrinking and replay, which are the reason to use a library.

## Consequences

- One more development dependency, updated by Renovate.
- A property can pass without proving anything if most generated input matches nothing. Rules that
  depend on results therefore assert that something was actually checked.
- Properties use seeded data where totals matter, because parallel tests create products of their own.
- Properties are read-only or rejected writes where possible, so generated input leaves nothing
  behind.
