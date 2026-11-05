# 0013: A background worker in the Toolshop stack

**Status:** Accepted

## Context

Toolshop generates invoice PDFs and processes its queue from cron, and the upstream image only runs
php-fpm. Without something doing that job, PDFs never exist, so a test of who may download one cannot
fail for the right reason. Stock also never changes after a checkout.

The obvious fix is a container running `schedule:run`. It would have caused problems, found by
reading the scheduled commands:

- `order:update` moves invoices through their statuses, underneath tests that assert a status.
- It runs once a minute, which is slow for a test to wait on.
- Queued mail goes to a `mailcatcher` host this stack does not have, and each attempt blocks the
  queue until it times out.

## Decision

Add a `worker` service that loops over `invoice:generate` and `queue:work --stop-when-empty`, with
a 5-second pause. It shares the API's image and environment through YAML anchors, so the two cannot
drift apart. Both use Laravel's `array` mailer, because queued mail keeps the mailer it was queued
with, so setting it on the worker alone changes nothing.

## Consequences

- PDF generation is real, so the matrix covers PDF access and `pollUntil` has a genuine use.
- Stock now really goes down after a checkout, and the UI tests open the first products in the
  catalogue. So `TestData` orders buy a rental, which has no stock count. Spreading orders across
  products was tried first, and only delayed the failure.
- A freshly seeded stack has about 200 invoices to work through, so the first PDF takes over a minute
  under emulation. The wait allows 150 seconds.
- `order:update` never runs, so nothing here covers automatic status changes.
- `toolshop:seed` also removes old PDFs, because invoice numbers restart and a stale file would match
  a new invoice, and clears the cache, because product ids change.
- Orphan invoices (F-14) fail their PDF job on every pass, which adds rows to `failed_jobs`. This is
  harmless, and a reseed clears it.
