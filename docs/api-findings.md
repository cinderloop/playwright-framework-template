# API findings

Behaviour in Toolshop that the advanced API suites treat as wrong, or that is worth a decision.
Toolshop is a practice app, so some of this may be intentional, and the code does not say which.
**Nothing here has been reported upstream.** That is for the repository owner to decide.

Everything was observed on the local Docker stack (`TEST_ENV=local`). The hosted demo was not tested,
so none of this is a claim about it.

Rows marked as known issues assert the correct behaviour with `test.fail()` and carry a
`known-issue` annotation. They stay green while the defect exists and go red when it changes. Later
phases add more.

| ID   | Severity | Summary                                                  | Covered by                  |
| ---- | -------- | -------------------------------------------------------- | --------------------------- |
| F-02 | Critical | Anyone can reset any account to a fixed password         | Known issue                 |
| F-03 | Critical | Any customer can change any invoice's status and columns | Known issue, matrix         |
| F-04 | High     | Owners can set an invoice's total and owner              | Known issue                 |
| F-05 | High     | GraphQL skips the REST authorization rules               | Known issue, matrix         |
| F-06 | High     | Card number and CVV are returned by the API              | Known issue                 |
| F-07 | High     | Catalogue writes need no token                           | Deliberate, not asserted    |
| F-08 | High     | Any customer can download any invoice PDF                | Known issue, matrix         |
| F-09 | High     | Customers can set their own account state                | Known issue                 |
| F-10 | High     | Any customer can search all customers                    | Known issue, matrix         |
| F-11 | Medium   | Any customer can read any favorite                       | Known issue, matrix         |
| F-12 | Medium   | Any customer can reply to or close any message           | Known issue, matrix         |
| F-13 | Medium   | Any customer can change product specs                    | Known issue, matrix         |
| F-14 | Medium   | Failed checkouts leave empty invoices                    | Known issue                 |
| F-15 | Medium   | Tokens survive a password change and a lockout           | Known issue                 |
| F-16 | Medium   | `429` has no `Retry-After` header                        | Known issue                 |
| F-17 | Medium   | Stack traces and SQL appear in error responses           | Known issue                 |
| F-18 | Low      | Misleading responses to refused cross-user requests      | Accepted, matrix            |
| F-19 | Medium   | A cart can be checked out repeatedly                     | Known issue                 |
| F-20 | Low      | An empty cart can be checked out                         | Known issue                 |
| F-21 | Low      | Forgot-password reveals which emails are registered      | Known issue                 |
| F-24 | Low      | Deleting an unknown user answers `500`                   | Worked around in cleanup    |
| F-25 | Low      | The spec does not match the API                          | Reported by `check:openapi` |
| F-26 | Low      | Parallel additions create duplicate cart rows            | Reported, not asserted      |
| F-27 | Low      | Registration depends on an external service              | Not asserted                |

## Coverage gap: tampered and forged tokens

There are no automated tests for tampered signatures, altered claims or `alg: none` tokens. They were
left out of Phase 3 by decision. Missing, malformed, logged-out, refreshed and expired tokens are
covered in `tests/api/advanced/tokens.spec.ts`.

The Phase 0 reconnaissance tried these cases by hand and each returned `401`. That was a single
manual check and nothing re-tests it, so a regression here would not be caught.

## F-02: Anyone can reset any account to a fixed password

- **Endpoint:** `POST /users/forgot-password`
- **Steps:** With no token, send a registered email. Then log in with that email and `welcome02`.
- **Expected:** The password does not change until the account holder proves they own the email.
- **Actual:** `200`, the password becomes `welcome02`, and the login succeeds. The old password stops
  working, so this also locks the owner out.
- **Evidence:** `UserService::resetPassword` hardcodes the value. Tested on throwaway accounts only.
  Nothing in the code excludes admins, but that was not tried on the seeded admin.
- **Intentional?** Possibly, as a practice app convenience. It would be critical in a real shop.

## F-03: Any customer can change any invoice's status and columns

- **Endpoint:** `PUT /invoices/{id}/status`
- **Steps:** Customer A checks out. Customer B sends `{"status":"SHIPPED"}` to A's invoice. Adding
  `"total":0.01` to the body also changes the total.
- **Expected:** `403` or `404`, and nothing changes. Only admins should set a status, so `403` for
  the owner too.
- **Actual:** `200`, and the status changes. The extra `total` is written as well.
- **Evidence:** `InvoiceService::updateInvoiceStatus` runs `Invoice::where('id', $id)->update($data)`
  with `$request->all()`: no owner or role check, and the query builder ignores `$fillable`.
- **Intentional?** Unlikely. Other invoice endpoints filter by owner.

## F-04: Owners can set an invoice's total and owner

- **Endpoint:** `PUT /invoices/{id}`
- **Steps:** A customer sends a valid update of their own invoice with `"total":0.5`, or with another
  customer's `user_id`.
- **Expected:** Both fields are ignored or rejected.
- **Actual:** `200`. The total changes, and the invoice moves to the other customer's account.
- **Evidence:** `InvoiceService::updateInvoice` passes `$request->all()` to `update()`, and both
  fields are in `$fillable`. `PATCH` is safe because it uses only validated fields.
- **Intentional?** Unlikely.

## F-05: GraphQL skips the REST authorization rules

- **Endpoint:** `POST /graphql` (undocumented)
- **Steps:** With a customer token, query `users`, `user(id)` or `invoice(id)` for other accounts, or
  run `deleteProduct`.
- **Expected:** Refused, matching REST: `GET /users` is admin only, invoices are owner only, and
  `DELETE /products/{id}` is admin only.
- **Actual:** All succeed. `users` lists every account, admins included, and `deleteProduct` removes
  the product.
- **Evidence:** `graphql/schema.graphql` uses `@guard` (any logged-in user) and no role or owner
  rules.
- **Intentional?** Unclear. It may simply be a less finished part of the app.

## F-06: Card number and CVV are returned by the API

- **Endpoint:** `GET /invoices/{id}`
- **Steps:** Check out with `credit-card`, then read the invoice as its owner or as an admin.
- **Expected:** Card data is not stored in full, and the CVV is never stored.
- **Actual:** `payment.payment_details` has the full number and CVV. The checkout response and the
  invoice list do not include them.
- **Evidence:** `payment_credit_card_details` has plain `credit_card_number` and `cvv` columns.
- **Intentional?** Probably a simplification, but it is a clear violation in a real shop.

## F-07: Catalogue writes need no token

- **Endpoint:** `POST /products`, `/brands`, `/categories`, and `PUT` and `PATCH` on each
- **Steps:** Send any of these with no token, e.g. `PATCH /products/{id}` with `{"price":0.01}`.
- **Expected:** In a real shop, `401`, and admin only.
- **Actual:** Success. The price changes.
- **Evidence:** No auth middleware on these routes. `ProductPolicy` says admin, but it is not applied.
- **Intentional?** Treated as deliberate: the spec documents them as unsecured, and this framework's
  `testData` relies on it. Not asserted by the matrix.

## F-08: Any customer can download any invoice PDF

- **Endpoint:** `GET /invoices/{number}/download-pdf`, `GET /invoices/{number}/download-pdf-status`
- **Steps:** With a generated PDF, request it as an unrelated customer. Invoice numbers are
  sequential.
- **Expected:** `403` or `404`.
- **Actual:** `200` and the PDF.
- **Evidence:** `InvoiceService::downloadPDF` checks only that the file exists.
- **Intentional?** Unlikely.
- **Note:** Needs the `worker` service in `docker-compose.yml`. Without it no PDF exists, and a `404`
  would prove nothing.

## F-09: Customers can set their own account state

- **Endpoint:** `POST /users/register`, `PATCH /users/{id}`, `PUT /users/{id}`
- **Steps:** Send `enabled` or `failed_login_attempts` when registering or patching yourself, or
  `totp_enabled` in a `PUT`.
- **Expected:** All are ignored. Only an admin should change account state, and two-factor login
  should need a verified code.
- **Actual:** All are stored. A locked customer can clear their own lockout using an existing token.
- **Evidence:** The fields are in `User::$fillable`. `PatchCustomer` validates them as allowed input.
- **Intentional?** Unlikely. `role` is protected on the same endpoints.

## F-10: Any customer can search all customers

- **Endpoint:** `GET /users/search`
- **Steps:** With a customer token, request `/users/search?q=a`.
- **Expected:** `403`, as `GET /users` is admin only.
- **Actual:** `200` with other customers' email, phone, date of birth and address.
- **Evidence:** `UserController` applies `role:admin` to `index` and `destroy` only.
- **Intentional?** Unlikely, because the matching list endpoint is protected.

## F-11: Any customer can read any favorite

- **Endpoint:** `GET /favorites/{id}`
- **Steps:** Customer A creates a favorite. Customer B requests it by id.
- **Expected:** `403` or `404`.
- **Actual:** `200` with A's `user_id` and `product_id`.
- **Evidence:** `FavoriteService::getFavoriteById` has no owner filter, unlike the list and delete.
- **Intentional?** Unlikely.

## F-12: Any customer can reply to or close any message

- **Endpoint:** `POST /messages/{id}/reply`, `PUT /messages/{id}/status`
- **Steps:** Customer A sends a message. Customer B replies to it, or sets it to `RESOLVED`.
- **Expected:** `403` or `404`. Only admins should change a status, so `403` for the owner too.
- **Actual:** `201` and `200`.
- **Evidence:** `ContactService::addReply` and `updateStatus` have no owner or role check, while
  reads do.
- **Intentional?** Unlikely for other customers. The owner replying to their own thread is allowed
  by the matrix.

## F-13: Any customer can change product specs

- **Endpoint:** `POST /products/{id}/specs`, `PUT` and `DELETE /products/{id}/specs/{specId}`
- **Steps:** With a customer token, create, change or delete a spec.
- **Expected:** `403`, as other catalogue deletes are admin only.
- **Actual:** `201`, `200` and `204`.
- **Evidence:** `ProductSpecController` requires a token but no role. The spec lists only `apiAuth`.
- **Intentional?** Possibly. The expectation here is an inference from the rest of the catalogue.

## F-14: Failed checkouts leave empty invoices

- **Endpoint:** `POST /invoices`
- **Steps:** Check out with an unknown `cart_id`, or with `payment_details` as a string.
- **Expected:** The request fails and nothing is stored.
- **Actual:** `404` or `500`, but an invoice remains with null totals and no payment. It appears in
  the customer's history, and its PDF job never finishes.
- **Evidence:** `InvoiceService::createInvoice` saves the invoice before it looks up the cart, with no
  transaction.
- **Intentional?** No.

## F-15: Tokens survive a password change and a lockout

- **Endpoint:** `POST /users/change-password`, `POST /users/login`
- **Steps:** With a live token, change the password, or lock the account with failed logins. Then use
  the token.
- **Expected:** `401`: both events should end existing sessions.
- **Actual:** `200` until the token expires, up to 5 minutes later.
- **Evidence:** Neither path invalidates tokens. The short lifetime limits the exposure.
- **Intentional?** Probably a side effect of stateless tokens.

## F-16: `429` has no `Retry-After` header

- **Endpoint:** `GET /reports/*`
- **Steps:** Exceed 60 requests a minute as one user.
- **Expected:** `429` with `Retry-After`.
- **Actual:** `429` with no `Retry-After` and no `X-RateLimit-*` headers. Normal responses do have
  `X-RateLimit-*`.
- **Evidence:** `Handler::render` builds a new JSON response and drops the exception's headers.
- **Intentional?** No, it looks like an oversight.

## F-17: Stack traces and SQL appear in error responses

- **Endpoint:** `POST /invoices`, `GET /users/refresh`, `PUT /users/{id}`, `PATCH /users/{id}`
- **Steps:** Send `payment_details` as a string, call refresh with no token, or update your email to
  one already taken.
- **Expected:** A plain error: `422`, `401` and `409`.
- **Actual:** `500` with the exception, file paths and a stack trace, or `403` with the raw SQL error.
- **Evidence:** The image runs with `APP_DEBUG=true`, and `UserController` returns `getMessage()`.
- **Intentional?** The traces may be local only, as they depend on `APP_DEBUG`. The SQL text does not.

## F-18: Misleading responses to refused cross-user requests

- **Endpoint:** `DELETE /favorites/{id}`, `GET /messages/{id}`
- **Steps:** Customer B deletes A's favorite, or reads A's message.
- **Expected:** `403` or `404`.
- **Actual:** `204` with nothing deleted, and `200 []` (also returned for an unknown id).
- **Evidence:** The delete filters by owner and ignores the row count. The read uses `first()` and
  returns the empty result.
- **Intentional?** Probably not, but harmless: nothing is changed or revealed. The matrix accepts
  these and proves that with a read-back. See ADR 0009.

## F-19: A cart can be checked out repeatedly

- **Endpoint:** `POST /invoices`
- **Steps:** Check out the same `cart_id` twice, one after the other or in parallel.
- **Expected:** One invoice. The second request is refused.
- **Actual:** `201` both times and two invoices. In a parallel run, both invoices were also once
  given the same `invoice_number`.
- **Evidence:** The cart is neither deleted nor marked after checkout. `invoice_number` has no unique
  index.
- **Intentional?** Unlikely.
- **Note:** The count is asserted. The duplicate number is not, because it depends on timing.

## F-20: An empty cart can be checked out

- **Endpoint:** `POST /invoices`
- **Steps:** Create a cart, add nothing, and check it out.
- **Expected:** `422`.
- **Actual:** `201` and an invoice with a total of `0`.
- **Evidence:** `InvoiceService::createInvoice` does not check for items.
- **Intentional?** Unlikely.

## F-21: Forgot-password reveals which emails are registered

- **Endpoint:** `POST /users/forgot-password`
- **Steps:** Send a registered email, then an unknown one.
- **Expected:** The same response for both.
- **Actual:** `200` and `422`.
- **Evidence:** The request is validated with `exists:users,email`.
- **Intentional?** Unlikely, though common.

## F-24: Deleting an unknown user answers `500`

- **Endpoint:** `DELETE /users/{id}`
- **Steps:** As admin, delete a user id that does not exist, or the same user twice.
- **Expected:** `404`, as the spec documents.
- **Actual:** `500` with `No query results for model [App\Models\User] ...`.
- **Evidence:** `UserController::destroy` catches every exception, including `ModelNotFoundException`.
- **Intentional?** No, it looks like an oversight.
- **Note:** `TestData` checks that a customer exists before deleting them, rather than treating
  `500` as success.

## F-25: The spec does not match the API

- **Endpoint:** Many. `npm run check:openapi` lists every difference.
- **Steps:** Run the check. On Toolshop API 5.0.0, 22 of the 39 sampled responses differ from the spec.
- **Expected:** The spec describes what the API returns.
- **Actual:** The main patterns are:
  - **Wrong success status:** `POST /products`, `/invoices`, `/favorites` and
    `/messages/{id}/reply` return `201`, documented as `200`.
  - **Undocumented errors:** `401` on login, `422` on forgot-password, and the `500`s from F-17 and
    F-24.
  - **Wrong body shape:** `POST /messages` documents `{success}` but returns the message.
    `PUT /carts/{id}/product/quantity` documents `success` but returns `result`.
    `GET /messages/{id}` returns an array for an unknown id.
  - **Undocumented fields:** `payment` and `eco_discount_*` on invoices, `specs` on products, and
    everything but `id` on carts.
  - **Documented but absent fields:** `enabled` and `failed_login_attempts` on users, `sub_categories`
    outside the tree, and `slug` on nested brands.
  - **Null not documented:** `co2_rating`, `status_message` and the invoice discount fields.
- **Evidence:** The `openapi-drift` attachment, and the job summary on nightly runs. The spec also has
  no `required` lists on its response schemas.
- **Intentional?** No, but it is normal for hand-maintained annotations to fall behind the code.

## F-26: Parallel additions create duplicate cart rows

- **Endpoint:** `POST /carts/{id}`
- **Steps:** Send several parallel requests adding the same product to an empty cart.
- **Expected:** One row, with the combined quantity.
- **Actual:** Two or three rows for that product, in all 12 trials of 4 parallel requests. The total
  quantity stayed correct.
- **Evidence:** `CartService::addItemToCart` uses `firstOrCreate` with no unique index on cart and
  product. Once a row exists, parallel additions are safe.
- **Intentional?** No, it is a race condition.
- **Note:** Not asserted, because it depends on timing. The suite checks the total, which always
  holds.

## F-27: Registration depends on an external service

- **Endpoint:** `POST /users/register`, `POST /users/change-password`
- **Steps:** Register while `api.pwnedpasswords.com` is slow.
- **Expected:** A local test stack does not depend on a third party.
- **Actual:** The `uncompromised()` password rule calls that service, with a 30-second timeout.
- **Evidence:** One `POST /users/register` exceeded the 10-second limit in about 960 test runs, while
  the 26 tests running alongside it took 2.1 seconds at most. This is the likely cause, not a
  confirmed one: the service's response time was not measured.
- **Intentional?** Yes, the password check is deliberate. The effect on test runs is a side effect.
- **Note:** CI's retries absorb it. A run with no internet access was not tried.
