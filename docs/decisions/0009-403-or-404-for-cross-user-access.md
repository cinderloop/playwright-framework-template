# 0009: Accept 403 or 404 for cross-user access

**Status:** Accepted

## Context

When one customer asks for another customer's resource, `403` says "this exists and is not yours",
while `404` hides whether it exists at all. Both are defensible. `404` leaks less, and `403` is more
honest to clients. The Toolshop spec does not choose, and the API uses both: `GET /users/{id}` and
`GET /invoices/{id}` answer `404`, `PUT /users/{id}` answers `403`.

## Decision

The matrix accepts either `403` or `404` for cross-user access. The property that matters is that
the request is refused and nothing is revealed or changed, not which refusal is used.

Exceptions:

- Role checks, as opposed to ownership checks, must be `403`. The caller may know the resource
  exists, and the matrix asserts it for rows such as `DELETE /users/{id}` as a customer.
- Two Toolshop responses are neither, but are safe: `204` on `DELETE /favorites/{id}` (deletes
  nothing) and `200 []` on `GET /messages/{id}`. The matrix accepts them only together with a
  `verify` step proving nothing was changed or revealed. They are recorded as finding F-18.

## Consequences

- Toolshop's mix of `403` and `404` is not reported as a defect, and the inconsistency is noted here
  rather than in every row.
- A stricter project could narrow `DENIED` in the matrix to one status.
- Rows that accept `200` or `204` depend entirely on their `verify` step, so removing one would
  silently weaken the row.
