# API testing

How the API layer is built, what each advanced technique catches, and how to reuse it. The examples
run against Toolshop, a practice app, so some of what they find is deliberate.

- [How the layer is built](#how-the-layer-is-built)
- [Core and example](#core-and-example)
- [The advanced suites](#the-advanced-suites)
- [Known issues](#known-issues)
- [Adapting to another API](#adapting-to-another-api)
- [What is not covered](#what-is-not-covered)

## How the layer is built

**Clients.** Each resource has a client in `src/app/api` that extends `BaseApiClient`, with two
kinds of method:

- `x(...)` requires the expected status and returns the body parsed by a Zod schema, for tests that
  need valid data.
- `xResponse(...)` returns the raw `APIResponse` whatever its status, for negative tests.

**Schemas.** Zod schemas in `src/app/schemas` validate responses, and types are inferred from them.
Zod removes keys a schema does not mention, which matters for one technique below: a test about
leaked fields has to read the raw response, not a parsed one.

**Fixtures.**

| Fixture                | What it gives you                                          |
| ---------------------- | ---------------------------------------------------------- |
| `api`                  | Anonymous clients                                          |
| `customerApi`          | Clients signed in as the configured customer               |
| `adminApi`             | Clients signed in as the configured admin                  |
| `apiWithToken`         | Clients for any token                                      |
| `testData`             | Creates data through the API and removes it after the test |
| `apiRecorder`          | Redacted log of the test's API calls                       |
| `authorizationContext` | Actors and arrange steps for one matrix row                |

Toolshop tokens last five minutes, so these fixtures sign in per test.

**Diagnostics.** Every client call is recorded by `ApiRecorder`, with passwords, tokens, cookies and
card details masked as they arrive. When a test fails or retries, the log is attached to the report
as `api-exchanges`. A forced failure with a retry confirmed that this report holds no passwords,
tokens or card data.

Traces are off for the `api` and `contract` projects, because a trace stores raw requests and
redaction cannot reach it. **Browser projects keep traces on the first retry, and those do hold
passwords and tokens**, including from API fixtures used in the test. This cannot be switched off for
API traffic alone. It is acceptable for Toolshop, whose demo accounts are public, but the nightly
report is published to GitHub Pages. If you adopt this template with real credentials, turn traces
off or stop publishing the report.

## Core and example

`src/core` knows nothing about Toolshop. Deleting `src/app` and `tests` leaves it compiling.

| Reusable, in `src/core`                                     | Toolshop example                            |
| ----------------------------------------------------------- | ------------------------------------------- |
| `BaseApiClient`, `ApiRecorder`, redaction                   | `src/app/api`, `src/app/schemas`            |
| `buildMatrix`, `expandEntry`, `runAuthorizationMatrix`      | `src/app/authorization/matrix.ts`           |
| `compareOperation`, `formatDriftReport`, `specFingerprint`  | `src/app/contract`, `tests/contract`        |
| `toMatchSchema`, `toNotExposeFields`                        | `tests/api/advanced/sensitive-data.spec.ts` |
| `checkProperty`, `pollUntil`, `markKnownIssue`, `localOnly` | `tests/api/advanced/*.spec.ts`              |

## The advanced suites

Everything in `tests/api/advanced` is tagged `@api` and `@api-advanced`, and runs only with
`TEST_ENV=local`, because it writes data and probes other accounts. Run it with
`npm run test:api:advanced`. `npm run test:api` leaves it out, and PRs do not run it. Nightly runs
it in its own job.

| Technique          | What it catches                                            | Where                        |
| ------------------ | ---------------------------------------------------------- | ---------------------------- |
| Authorization      | Missing role and owner checks, including cross-user access | `authorization.spec.ts`      |
| Mass assignment    | Clients setting fields they should not control             | `mass-assignment.spec.ts`    |
| Sensitive data     | Secrets and card data in responses                         | `sensitive-data.spec.ts`     |
| Token handling     | Tokens that keep working when they should not              | `tokens.spec.ts`             |
| Account security   | Lockout, disabled accounts, password reset                 | `account-security.spec.ts`   |
| Rate limiting      | A limit that is missing or incomplete                      | `rate-limit.spec.ts`         |
| Error format       | Unknown error shapes and leaked internals                  | `error-format.spec.ts`       |
| Contract drift     | The API and its spec disagreeing                           | `tests/contract`             |
| Property-based     | Rules that break for inputs nobody thought of              | `catalog-properties.spec.ts` |
| Concurrency        | Race conditions and double submission                      | `concurrency.spec.ts`        |
| Idempotency        | Repeated requests doing more than once                     | `idempotency.spec.ts`        |
| Asynchronous flows | Background work that never finishes                        | `async-flows.spec.ts`        |

### Authorization matrix

Rules are declared as data in `src/app/authorization/matrix.ts`, and one test is generated per actor
per operation, with titles like `GET /invoices/{id} as other-user → 403/404`. A row states the
correct behaviour even when the app gets it wrong. For the reasoning, see
[ADR 0008](decisions/0008-authorization-matrix.md) and
[ADR 0009](decisions/0009-403-or-404-for-cross-user-access.md).

A status alone cannot prove everything, so a row can add `verify`. Refused writes read the resource
back, and GraphQL rows read the body, because a refusal there still answers `200`.

### Mass assignment

Each test sends fields a client should not control, then reads the result back or checks real
permissions, such as calling an admin endpoint. A `2xx` proves nothing here.

### Sensitive data

`toNotExposeFields` searches a body recursively and prints only paths, so a failure cannot copy the
secret into a report. Always give it a raw response: Zod strips unknown keys, so a parsed body cannot
show a leak.

### Rate limiting

Toolshop limits only `/reports`. The test sends the allowance and one more, then stops. The limit is
per user, so it uses a new customer and leaves the admin's allowance alone.

### Contract drift

`npm run check:openapi` compares real responses with the spec, and prints a report. A JSON Schema
validator would accept almost anything, because the spec has no `required` lists, so a small
comparison reports undocumented and missing fields instead. See
[ADR 0010](decisions/0010-contract-drift-check.md).

Only a changed spec or a broken framework schema fails the check. Drift itself is a finding. After
reviewing a changed spec, run `npm run check:openapi:update`.

### Property-based tests

`checkProperty` runs a [fast-check](https://fast-check.dev) property a bounded number of times. To
repeat a failure, use the seed from the error or the `property-seed` annotation:

```bash
PROPERTY_SEED=716108836 npx playwright test -g "every sort order holds"
```

Two habits keep these honest:

- Parallel tests create products, so anything about totals filters to seeded data.
- A property can pass while checking nothing if most inputs match nothing, so result-based rules
  assert that something was checked.

### Concurrency

Requests go through `Promise.all` with fresh data, and each assertion must hold however they
interleave. Effects that depend on timing are recorded as findings, not asserted. See
[Known issues](#known-issues).

### Asynchronous flows

Invoice PDF generation is the only one. It needs the `worker` service in `docker-compose.yml`, which
plays the part of upstream's cron ([ADR 0013](decisions/0013-background-worker-in-the-stack.md)).
Tests wait with `pollUntil`, never with a fixed delay. On a freshly seeded stack the first PDF takes
over a minute, because the worker has about 200 seeded invoices to get through first.

### Slow test

`a token expires, and can then be refreshed` waits out the real five-minute lifetime. It uses the
seeded customer rather than `testData`, because an admin token fetched for cleanup would have expired
by the end.

## Known issues

Some tests expose real defects. They assert the **correct** behaviour and are marked as expected
failures, so the suite stays green while the defect exists and goes red when it changes. Each one
has a `known-issue` annotation and an entry in [api-findings.md](api-findings.md).

The placing matters. `test.fail()` at the top of a test would also excuse broken setup, so:

- The matrix applies it after the request, and only for the status recorded on that row.
- Hand-written tests call `markKnownIssue` directly before the assertion that exposes the defect.

```ts
const response = await customer.api.invoices.updateResponse(invoice.id, { ...input, total: 0.5 });
expect(response.status()).toBe(200);
const stored = await customer.api.invoices.get(invoice.id);

markKnownIssue('F-04', 'an owner can set the total of their invoice');
expect(stored.total).toBe(invoice.total);
```

When a defect is fixed, the test reports an unexpected pass. Remove the `markKnownIssue` call or the
`knownIssue` entry, and update the findings document.

Use this only for failures that happen every time. A race that fails on most runs would flip between
pass and fail, so assert what always holds and record the rest as a finding.

## Adapting to another API

### The authorization matrix

1. Decide who your actors are, and write a type for them.
2. Create a context that implements `AuthorizationContext`. Its `actor` method returns a client for
   each actor, and it holds your arrange steps. See `src/app/authorization/context.ts`.
3. Provide it as a fixture named `authorizationContext`. Playwright reads fixture names from source,
   so the name is fixed.
4. Declare entries with `expandEntry`, combine them with `buildMatrix`, and generate the tests:

```ts
const rows = buildMatrix(
  expandEntry({
    name: 'GET /orders/{id}',
    arrange: (context) => context.order(),
    request: (client, order) => client.orders.getResponse(order.id),
    expectations: { anonymous: 401, owner: 200, 'other-user': [403, 404], admin: 200 },
  }),
);

test.describe('Authorization', () => {
  localOnly(config.environment);
  runAuthorizationMatrix(test, rows);
});
```

Decide what your API should answer for cross-user access. If it should always be `404`, use one
status rather than a list.

### The drift check

1. List your operations in `src/app/contract/operations.ts`, using the spec's own paths and
   parameter names, and include error responses.
2. Create the data they refer to in `src/app/contract/samples.ts`.
3. Point the requests in `tests/contract/openapi.spec.ts` at your spec's URL.
4. Run `npm run check:openapi:update` once, to record the reviewed spec.

If your spec declares `required` and `additionalProperties`, a JSON Schema validator may suit you
better. The comparison only supports the schema features Toolshop's spec uses.

## What is not covered

Deliberately out of scope:

- **Consumer-driven contracts (Pact).** They need an independently owned consumer and provider. See
  [ADR 0011](decisions/0011-no-consumer-driven-contract-testing.md).
- **Response-time assertions in functional tests.** Timing belongs in performance tests, and here it
  would mostly measure the machine.
- **Load testing.** It needs its own tools, and a practice app in Docker tells you little.

Known gaps:

- **Tampered and forged tokens.** There are no automated tests for tampered signatures, altered
  claims or `alg: none`. They were checked by hand once, and each returned `401`.
- **Endpoints not exercised:** `POST /totp/*`, `POST /payment/check`, `POST /messages/{id}/attach-file`,
  `GET /sales-stream` and social login.
- **`POST /refresh`.** It wipes the database with no login, so it is deliberately never called.
- **`order:update`.** The worker does not run it, so automatic invoice status changes are not tested.
- **The hosted demo.** Advanced suites never touch it, so no finding is a claim about it.
