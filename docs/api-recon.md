# API reconnaissance (Phase 0)

What local Toolshop actually does, as input to the advanced API layer. Nothing in `src/` or `tests/` changed for this phase.

**Target:** the Docker Compose stack in this repo (Sprint 5 API image, pinned by digest), `TEST_ENV=local`, on 2026-11-05. **The hosted demo was not contacted**, so nothing here is a claim about it.

**Evidence labels:** `live` means observed against the running API with throwaway accounts. `source` means read in the Laravel source only and not executed. The "intended roles" column is my reading of the spec, policies and route names, not something Toolshop states.

**How it was gathered:** the spec, `php artisan route:list`, the controllers, services, policies and form requests inside the `laravel-api` container, then live requests. Seeded accounts were only used to log in as admin for reads. The stack was reseeded afterwards.

## 1. OpenAPI spec

|                 |                                                                    |
| --------------- | ------------------------------------------------------------------ |
| Spec JSON       | `GET /docs` (`http://localhost:8091/docs`)                         |
| Swagger UI      | `GET /api/documentation`                                           |
| Not valid paths | `/docs/api-docs.json` and `/api-docs.json` both return 404         |
| Version         | OpenAPI 3.2.0, "Toolshop API" 5.0.0                                |
| Size            | 81 operations, 33 component schemas                                |
| SHA-256         | `a1b79c7e0df4ee64f3ae0fbc76401c1e2071fc5fbaa00bb8b89d482df09e9580` |
| Security scheme | `apiAuth`: HTTP bearer, JWT                                        |
| Source in image | `storage/api-docs/api-docs.json`, pre-generated                    |

All 81 documented operations exist in the route table. Routes that exist but are **not documented** (OPTIONS excluded):

- `POST /refresh` (see F-01), `GET /status`, `POST /totp/login/totp`
- `GET|POST /graphql`, `GET /graphiql` (see F-05)
- `GET /auth/social-login`, `GET /auth/cb/google`, `GET /auth/cb/github`
- `QUERY` variants of `/products`, `/products/search`, `/brands/search`, `/categories/search`, `/categories/tree`, `/invoices/search`, `/users/search`

Two spec properties limit the Phase 4 drift check: **no response schema declares `required`**, so a validator cannot detect a missing field from the spec alone, and `CartResponse` documents only `id`.

## 2. Endpoint inventory

"Actual auth" is what the code enforces: `none`, `token` (any logged-in user) or `admin`. The "Owner" column marks resources that belong to one user.

### Auth and users

| Method and path                    | Actual auth  | Intended roles | Owner | Notes                                                       |
| ---------------------------------- | ------------ | -------------- | ----- | ----------------------------------------------------------- |
| `POST /users/register`             | none         | anyone         |       | Forces `role=user`; other privileged fields accepted (F-09) |
| `POST /users/login`                | none         | anyone         |       | 3 failures lock non-admins (`423`)                          |
| `POST /users/forgot-password`      | none         | anyone         |       | Resets to a fixed password (F-02)                           |
| `POST /users/change-password`      | token        | self           | yes   | Acts on the token's user only                               |
| `GET /users/me`                    | token        | self           | yes   |                                                             |
| `GET /users/logout`                | token        | self           | yes   | Blacklists the token                                        |
| `GET /users/refresh`               | none in code | token holder   | yes   | Spec says secured; no token gives `500` (F-17)              |
| `GET /users`                       | admin        | admin          |       | Customer `403`                                              |
| `GET /users/search`                | token        | admin          |       | Any customer can search all customers (F-10)                |
| `GET /users/{id}`                  | token        | self, admin    | yes   | Cross-user `404`                                            |
| `PUT, PATCH /users/{id}`           | token        | self, admin    | yes   | Cross-user `403`. This is also the address resource         |
| `DELETE /users/{id}`               | admin        | admin          |       | Customer `403`                                              |
| `POST /totp/setup`, `/totp/verify` | token        | self           | yes   | Not probed                                                  |

### Invoices, payments, favorites, messages

| Method and path                              | Actual auth | Intended roles | Owner | Notes                                           |
| -------------------------------------------- | ----------- | -------------- | ----- | ----------------------------------------------- |
| `GET /invoices`, `/invoices/search`          | token       | owner, admin   | yes   | Filtered to the caller's own                    |
| `POST /invoices`                             | token       | customer       | yes   | `user_id` forced to the caller                  |
| `POST /invoices/guest`                       | none        | anyone         |       | `user_id` null                                  |
| `GET /invoices/{id}`                         | token       | owner, admin   | yes   | Cross-user `404`. Exposes card data (F-06)      |
| `PUT /invoices/{id}`                         | token       | owner          | yes   | Cross-user `404`. Mass assignment (F-04)        |
| `PATCH /invoices/{id}`                       | token       | owner          | yes   | Cross-user `404`. `total` ignored, safe         |
| `PUT /invoices/{id}/status`                  | token       | admin          | yes   | **No owner or role check** (F-03)               |
| `GET /invoices/{number}/download-pdf`        | token       | owner, admin   | yes   | **No owner check** (F-08)                       |
| `GET /invoices/{number}/download-pdf-status` | token       | owner, admin   | yes   | **No owner check** (F-08)                       |
| `POST /payment/check`                        | none        | anyone         |       | Not probed                                      |
| `GET /favorites`                             | token       | owner          | yes   | Filtered to the caller's own                    |
| `POST /favorites`                            | token       | customer       | yes   | Forged `user_id` overwritten. Duplicate `409`   |
| `GET /favorites/{id}`                        | token       | owner          | yes   | **No owner check** (F-11)                       |
| `DELETE /favorites/{id}`                     | token       | owner          | yes   | Cross-user `204` but deletes nothing (F-18)     |
| `POST /messages`                             | none        | anyone         |       | Forged `user_id` accepted when anonymous (F-12) |
| `POST /messages/{id}/attach-file`            | none        | message sender | yes   | Not probed                                      |
| `GET /messages`                              | token       | owner, admin   | yes   | Filtered to the caller's own                    |
| `GET /messages/{id}`                         | token       | owner, admin   | yes   | Cross-user `200 []` (F-18)                      |
| `POST /messages/{id}/reply`                  | token       | owner, admin   | yes   | **No owner check** (F-12)                       |
| `PUT /messages/{id}/status`                  | token       | admin          | yes   | **No owner or role check** (F-12)               |

### Carts

Carts have no owner: the table has no `user_id`, and every endpoint is anonymous. The unguessable ULID is the only control.

| Method and path                          | Actual auth | Owner | Notes               |
| ---------------------------------------- | ----------- | ----- | ------------------- |
| `POST /carts`                            | none        | no    |                     |
| `GET, POST /carts/{id}`                  | none        | no    | `POST` adds an item |
| `DELETE /carts/{id}`                     | none        | no    | Second delete `404` |
| `PUT /carts/{id}/product/quantity`       | none        | no    |                     |
| `DELETE /carts/{id}/product/{productId}` | none        | no    |                     |

### Catalogue and reference data

| Method and path                                                                      | Actual auth | Intended roles | Notes                           |
| ------------------------------------------------------------------------------------ | ----------- | -------------- | ------------------------------- |
| `GET /products`, `/products/search`, `/products/{id}`, `/products/{id}/related`      | none        | anyone         | Fixed page size of 9            |
| `POST /products`, `PUT, PATCH /products/{id}`                                        | none        | admin          | Unauthenticated writes (F-07)   |
| `DELETE /products/{id}`                                                              | admin       | admin          | Customer `403`, anonymous `401` |
| `GET /brands`, `/brands/search`, `/brands/{id}`                                      | none        | anyone         |                                 |
| `POST /brands`, `PUT, PATCH /brands/{id}`                                            | none        | admin          | Unauthenticated writes (F-07)   |
| `DELETE /brands/{id}`                                                                | admin       | admin          | Customer `403`, anonymous `401` |
| `GET /categories`, `/categories/tree`, `/categories/tree/{id}`, `/categories/search` | none        | anyone         |                                 |
| `POST /categories`, `PUT, PATCH /categories/{id}`                                    | none        | admin          | Unauthenticated writes (F-07)   |
| `DELETE /categories/{id}`                                                            | admin       | admin          |                                 |
| `GET /products/{id}/specs`, `/products/{id}/specs/{specId}`, `/product-specs/names`  | none        | anyone         |                                 |
| `POST /products/{id}/specs`, `PUT, DELETE /products/{id}/specs/{specId}`             | token       | admin          | Any customer can write (F-13)   |
| `GET /images`, `GET /postcode-lookup`                                                | none        | anyone         |                                 |

### Reports and streams

| Method and path                                                                                                                                                                                             | Actual auth | Notes                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| `GET /reports/` `total-sales-per-country`, `top10-purchased-products`, `top10-best-selling-categories`, `total-sales-of-years`, `average-sales-per-month`, `average-sales-per-week`, `customers-by-country` | admin       | Throttled at 60 per minute. Customer `403` |
| `GET /sales-stream`                                                                                                                                                                                         | none        | Server-sent events. Not probed             |

## 3. Cross-user access, as observed

Customer B acting on customer A's resource (`live`). This is the evidence for the 403 vs 404 ADR in Phase 2: Toolshop uses both, plus some responses that are neither.

| Operation                        | Result           | Reading                                |
| -------------------------------- | ---------------- | -------------------------------------- |
| `GET /users/{id}`                | `404`            | Correct, body uses `error`             |
| `PUT, PATCH /users/{id}`         | `403`            | Correct                                |
| `DELETE /users/{id}`             | `403`            | Correct                                |
| `GET, PUT, PATCH /invoices/{id}` | `404`            | Correct, body uses `message`           |
| `GET /invoices/search`           | `200`, 0 results | Correct                                |
| `DELETE /favorites/{id}`         | `204`            | Misleading: nothing is deleted         |
| `GET /messages/{id}`             | `200 []`         | Safe but wrong: same for an unknown id |
| `GET /favorites/{id}`            | `200`            | **Leak**                               |
| `PUT /invoices/{id}/status`      | `200`            | **Write succeeds**                     |
| `GET /invoices/{n}/download-pdf` | `200`            | **Leak**, returned a real PDF          |
| `POST /messages/{id}/reply`      | `201`            | **Write succeeds**                     |
| `PUT /messages/{id}/status`      | `200`            | **Write succeeds**                     |

## 4. Field protections

**Must never be client-settable, and the current result:**

| Field                                           | Where tried                     | Result                                          |
| ----------------------------------------------- | ------------------------------- | ----------------------------------------------- |
| `role`                                          | Register                        | Ignored, stays `user`. Correct                  |
| `role`                                          | `PATCH /users/{self}`           | Silently dropped. Correct                       |
| `role`                                          | `PUT /users/{self}`             | `403`. Correct                                  |
| `id`                                            | Register                        | Ignored. Correct                                |
| `password`                                      | `PUT /users/{self}`             | Ignored. Correct                                |
| `enabled`, `failed_login_attempts`              | Register, `PATCH /users/{self}` | **Accepted** (F-09)                             |
| `totp_secret`, `totp_enabled`                   | `PUT /users/{self}`             | **Accepted**, `totp_enabled` became true (F-09) |
| `user_id`, `total`                              | `PUT /invoices/{id}`            | **Accepted** (F-04)                             |
| any column, e.g. `total`                        | `PUT /invoices/{id}/status`     | **Accepted** (F-03)                             |
| `user_id`, `total`, `invoice_number`, discounts | `POST /invoices`                | Overwritten by the server. Correct              |
| `user_id`                                       | `POST /favorites`               | Overwritten by the server. Correct              |
| `user_id`                                       | `POST /messages`, anonymous     | **Accepted** (F-12)                             |

**Must never appear in responses:**

- `password`, `totp_secret`, `uid`: absent from register, `/users/me`, `/users/{id}`, `/users/search` and GraphQL. Correct.
- `role`, `enabled`, `failed_login_attempts`: hidden from customers, shown to admins by design. Exception: GraphQL returns `role` to customers (F-05).
- Card number and CVV: **returned** by `GET /invoices/{id}` (F-06).
- Product `stock`: hidden from anonymous and from admin in `GET /products/{id}`, despite `ProductPolicy::viewStock`.

## 5. Asynchronous flows

One genuine async flow exists: **invoice PDF generation**. `invoice:generate` creates a `downloads` row per invoice and queues `CreateInvoicePDF`. The status endpoint then moves through `NOT_INITIATED` (`400`), `INITIATED`, `IN_PROGRESS`, `COMPLETED`.

**It never runs in this repo's stack.** Both steps depend on `schedule:run`, and the `laravel-api` container only runs php-fpm. So a new invoice stays at `NOT_INITIATED` forever (`live`). Running the two artisan commands by hand worked, and the flow reached `COMPLETED` with a downloadable PDF.

The same gap affects other queued work: `QUEUE_CONNECTION=database`, so `UpdateProductInventory`, `SendCheckoutEmail` and all mail sit in the `jobs` table unprocessed. When processed by hand, 27 mail-related jobs failed because the stack has no `mailcatcher` host. Stock levels therefore do not change after checkout in this stack (`source`).

Phase 5 adds a scheduler service to enable this, see Decisions.

## 6. Rate limiting and lockout

- **Only `/reports/*` is rate limited**: 60 per minute, keyed per user. Other routes send no `X-RateLimit` headers (`live`).
- The 61st call returned `429` with body `{"message":"Too many requests"}` but **no `Retry-After` and no `X-RateLimit-*` headers** (F-16). Normal responses do carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`.
- **Login has no rate limit.** It has an account lockout instead: after 3 failures, non-admins get `423`, even with the right password (`live`). Admins are exempt (`source`, not tried on the seeded admin).

## 7. Token lifecycle

| Behaviour                                         | Result                                                                 | Evidence |
| ------------------------------------------------- | ---------------------------------------------------------------------- | -------- |
| Algorithm, claims                                 | HS256; `sub`, `role`, `exp`, `iat`, `nbf`, `iss`, `jti`, `prv`         | `live`   |
| TTL                                               | 300 seconds (`expires_in: 300`)                                        | `live`   |
| Refresh window                                    | 60 minutes (`JWT_REFRESH_TTL` default)                                 | `source` |
| Missing, malformed token                          | `401 {"message":"Unauthorized"}`                                       | `live`   |
| Tampered signature, tampered payload, `alg: none` | `401`, same body                                                       | `live`   |
| Real expiry after the TTL                         | `401 {"message":"Unauthorized"}` after 310 seconds                     | `live`   |
| Refresh after expiry                              | `GET /users/refresh` with the expired token issues a working new token | `live`   |
| `GET /users/refresh`                              | New token; old token then `401`                                        | `live`   |
| `GET /users/logout`                               | Token then `401`; second logout `401`                                  | `live`   |
| After password change                             | **Old token still works** (F-15)                                       | `live`   |
| Account locked                                    | **Existing token still works** (F-15)                                  | `live`   |
| Account disabled                                  | Login `403`, token `403 Account disabled.`                             | `live`   |

The 300-second TTL does not threaten the current suite, because `customerApi` and `adminApi` log in per test. Anything added with worker scope must not hold a token for longer than that.

## 8. Do the Zod schemas match the spec?

Broadly yes. Nothing Zod requires is missing from live responses on normal paths. Zod objects strip unknown keys, so extra fields pass silently, which is why the differences below have not shown up in tests.

| Schema                 | Difference                                                                                      | Action                            |
| ---------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------- |
| `userSchema`           | Spec and live have `provider`, `totp_enabled`, `created_at`; Zod omits them                     | Add in Phase 4 if tests need them |
| `userSchema`           | Spec documents `enabled`, `failed_login_attempts`; live shows them to admins only               | Spec drift                        |
| `userSchema`           | `register` omits `provider`, `totp_enabled`, though the spec uses one schema for both           | Spec drift                        |
| `invoiceSchema`        | Live has `payment`; **spec does not document it**, Zod requires it                              | Spec drift                        |
| `invoiceSchema`        | Live has `eco_discount_*`; spec and Zod omit them                                               | Spec drift, add to Zod            |
| `invoiceSchema`        | Zod requires numeric totals and `payment`, but orphan invoices have nulls (F-14)                | Zod is right, app defect          |
| `createdInvoiceSchema` | Spec reuses the full invoice schema; live omits `status`, `status_message`, `invoicelines`      | Spec drift, Zod matches live      |
| `invoiceLineSchema`    | Live has `discount_percentage`, `discounted_price`; Zod omits them                              | Add if tests need them            |
| `cartSchema`           | Spec documents `id` only; live has `lat`, `lng`, `additional_discount_percentage`, `cart_items` | Spec drift, Zod matches live      |
| `categorySchema`       | Spec gives `GET /categories` a `sub_categories` field; live has it only on `/categories/tree`   | Spec drift, Zod matches live      |
| `productSchema`        | Zod allows null `description`; spec says string                                                 | Zod is looser, harmless           |

**Status codes that differ from the spec (`live`):**

| Operation                                   | Spec                  | Live                       |
| ------------------------------------------- | --------------------- | -------------------------- |
| `POST /invoices`                            | `200`                 | `201`                      |
| `POST /invoices/guest`                      | `200`                 | `201`                      |
| `POST /products`                            | `200`                 | `201`                      |
| `POST /favorites`                           | `200`                 | `201`                      |
| `POST /messages/{id}/reply`                 | `200`                 | `201`                      |
| `GET /messages/{id}` unknown                | `404`                 | `200 []`                   |
| `GET /users/refresh` no token               | `401`                 | `500`                      |
| `PUT, PATCH /users/{id}` duplicate email    | `409`                 | `403`, raw SQL in the body |
| `POST /users/login` failures                | Only `200` documented | `401`, `423`, `403`        |
| `POST /users/forgot-password` unknown email | No `422` documented   | `422`                      |

**Error shapes are inconsistent**, which matters for the Phase 3 shared schema. There are four 4xx bodies: `{message}`, `{error}`, a bare field map, and `{message, errors}`. `errorMessageSchema` and `validationErrorSchema` already cover all of them. A single shape is not achievable, so the "schema family" approach in the plan is the right one.

## 9. Findings to confirm in later phases

Candidates for `docs/api-findings.md`. Severity is my estimate for a real shop. Toolshop is a practice app, so several of these may be deliberate, and I can't tell which from the code. Nothing has been reported upstream.

| ID   | Severity | Finding                                                                                                                                                                                              | Evidence               |
| ---- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| F-01 | Critical | `POST /refresh` runs `migrate:fresh --seed` with no auth and is undocumented. **Not executed**                                                                                                       | `source`               |
| F-02 | Critical | `POST /users/forgot-password` lets anyone reset any account to the fixed password `welcome02`, then log in as them                                                                                   | `live`, throwaway only |
| F-03 | Critical | `PUT /invoices/{id}/status`: any customer can change any invoice, and any extra column is written. B set A's `total` to 0.01                                                                         | `live`                 |
| F-04 | High     | `PUT /invoices/{id}`: an owner can set `total` and reassign `user_id` to another customer                                                                                                            | `live`                 |
| F-05 | High     | GraphQL skips REST rules: a customer listed users with emails and roles (admin included), read another customer's invoice, and deleted a product                                                     | `live`                 |
| F-06 | High     | Full card number and CVV are stored in plain text and returned by `GET /invoices/{id}`, to the owner and admins                                                                                      | `live`                 |
| F-07 | High     | Products, brands and categories can be created and changed with no token; a price was set to 0.01. The spec documents these as unsecured and `testData` relies on it, so this is probably deliberate | `live`                 |
| F-08 | High     | Any customer can download any invoice PDF by number, and numbers are sequential                                                                                                                      | `live`                 |
| F-09 | High     | Customers can set their own `enabled`, `failed_login_attempts`, `totp_secret`, `totp_enabled`. A locked account unlocked itself using its existing token                                             | `live`                 |
| F-10 | High     | `GET /users/search`: any customer can read other customers' email, phone, date of birth and address                                                                                                  | `live`                 |
| F-11 | Medium   | `GET /favorites/{id}` has no owner check                                                                                                                                                             | `live`                 |
| F-12 | Medium   | Any customer can reply to or change the status of any message; anonymous senders can attribute a message to any `user_id`                                                                            | `live`                 |
| F-13 | Medium   | Any customer can create, change or delete product specs                                                                                                                                              | `live`                 |
| F-14 | Medium   | Failed checkouts leave orphan invoices: an unknown `cart_id` returns `404` but keeps a row with null totals and no payment, and its PDF job stays `IN_PROGRESS`                                      | `live`                 |
| F-15 | Medium   | Tokens survive a password change and an account lockout                                                                                                                                              | `live`                 |
| F-16 | Medium   | `429` has no `Retry-After`: `Handler::render` rebuilds the response and drops the headers                                                                                                            | `live`                 |
| F-17 | Medium   | Debug details leak: stack traces on `500` (`payment_details` as a string, `/users/refresh` with no token) and raw SQL in a `403`. May be local only (`APP_DEBUG=true`)                               | `live`                 |
| F-18 | Low      | Misleading cross-user responses: `204` for a delete that did nothing, `200 []` for a missing message                                                                                                 | `live`                 |
| F-19 | Medium   | A cart can be checked out repeatedly. Two parallel checkouts both returned `201` with the **same** `invoice_number`, and there is no unique index. The duplicate number was seen in one run          | `live`                 |
| F-20 | Low      | Empty cart checks out with a `0` total                                                                                                                                                               | `live`                 |
| F-21 | Low      | Account enumeration: forgot-password returns `422` for unknown emails, `200` for known ones                                                                                                          | `live`                 |
| F-22 | Low      | REST still served a product straight after GraphQL deleted it (database row gone, `GET` still `200`): stale cache                                                                                    | `live`                 |
| F-23 | Low      | Admins are exempt from lockout and login has no rate limit, so admin passwords can be guessed without limit                                                                                          | `source`               |
| F-24 | Low      | `DELETE /users/{id}` for an unknown id answers `500`, found in Phase 2                                                                                                                               | `live`                 |

## 10. Proposed tests per phase

Counts are estimates. Items marked `known-issue` use `test.fail()` per the plan.

### Phase 1: core diagnostics

As planned. Two adjustments:

- Redaction defaults should also cover `totp_secret`, `credit_card_number`, `cvv` and `current_password`, `new_password`, `new_password_confirmation`, because these appear in Toolshop traffic.
- The polling helper has no real consumer until Phase 5 enables the PDF flow (see Decisions).

### Phase 2: authorization matrix (about 45 rows)

- **Owner-scoped, cross-user:** `users` (read, update, patch, delete), `invoices` (read, update, patch, status, PDF, PDF status), `favorites` (read, delete), `messages` (read, reply, status).
- **Admin-only:** `GET /users`, `DELETE /users/{id}`, the 7 reports, `DELETE` on products, brands and categories.
- **`known-issue` rows:** F-03, F-08, F-10, F-11, F-12, F-13.
- **403 vs 404 ADR:** accept either as "denied" and document it. Section 3 shows Toolshop itself uses both.
- The matrix needs an extra outcome for `200 []` and `204` no-ops, verified by reading state back, or it will treat those rows as leaks.

### Phase 3: security-adjacent (about 30 tests)

- **Mass assignment:** register and update rows from section 4. `known-issue`: F-04, F-09, F-12.
- **Sensitive data:** `toNotExposeFields` on auth, user and invoice responses. `known-issue`: F-06.
- **Tokens:** every row in section 7. `known-issue`: F-15.
- **Password reset:** F-02 as `known-issue`, against throwaway accounts only.
- **Rate limiting:** `/reports` only: 60 calls, then `429`. `Retry-After` as `known-issue` (F-16).
- **Error shapes:** one family check across the 4xx responses.

### Phase 4: contract drift

As planned. Because the spec has no `required` lists, comparing Zod to the spec will under-report. I recommend validating live responses and treating undocumented fields as drift, with the ADR explaining this. Section 8 is the starting list.

### Phase 5: robustness (about 20 tests)

- **Property-based:** page size is fixed at 9 and `per_page` is not a parameter, so the invariant is "at most 9". Use seeded data only, because catalogue reads are cached for up to 120 seconds and stale reads are possible (F-22).
- **Concurrency:** assert "at most one invoice" as `known-issue` (F-19). This fails reliably. **Do not assert on the duplicate invoice number**: that depends on timing, and `test.fail()` needs a deterministic failure.
- **Idempotency:** repeated `DELETE /carts/{id}` gives `404`. Repeated `PUT` on products and brands.

### Not applicable to Toolshop

| Planned item                           | Why                                               | Instead                             |
| -------------------------------------- | ------------------------------------------------- | ----------------------------------- |
| BOLA rows for carts                    | Carts have no owner, so there is nothing to cross | Document the capability-URL model   |
| A separate address resource            | No address endpoints; addresses live on the user  | Covered by `PUT, PATCH /users/{id}` |
| Rate limiting on login                 | Not implemented; lockout exists instead           | Test lockout                        |
| `Retry-After` passing                  | Header is never sent                              | `known-issue`                       |
| Idempotent `DELETE` on invoices        | No such route                                     | Use carts, products                 |
| Client-set page size in property tests | `per_page` is fixed by the server                 | Assert at most 9                    |
| Async polling, as the stack stands     | PDF flow never runs without a scheduler           | See Decisions                       |

## Decisions

Agreed by the owner on 2026-11-05.

1. **GraphQL scope:** add a small set of GraphQL rows to the Phase 2 matrix, because GraphQL bypasses REST authorization (F-05) and a REST-only matrix would overstate access control.
2. **PDF flow:** add a background service to `docker-compose.yml` in Phase 5 so the flow runs for real. Phase 5 built this as a `worker` service rather than `schedule:run`, see ADR 0013. This also makes F-08 testable without manual steps. It runs `queue:work` every minute during tests, so stock levels will start changing, and the existing suite must be rechecked when it lands.
3. **Expired-token test:** one slow `@api-advanced` test that uses `expect.poll` until the token returns `401`, about 5 minutes of nightly time, running alongside the other tests.
4. **F-07:** treat unauthenticated catalogue writes as deliberate, not `known-issue` rows, and list them in the findings doc. `testData` depends on them and the spec documents them.

## Baseline

After reseeding, `npm run test:api` passed: 31 of 31 tests. No probe data remained in the database (0 `recon.*` users, 0 queued or failed jobs, 0 downloads), and the generated PDFs were removed.
