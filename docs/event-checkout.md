# Event checkout and Stripe verification

October 16, 2026. The checkout implementation has been hardened and tested locally; **real Stripe test-mode card delivery is still pending a test API key**. Neither local nor beta had `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` configured at preflight. Do not treat mocked Stripe responses or signed offline fixtures as proof of an actual Stripe payment.

## Behavior

- Active, verified readers can buy for themselves and colleagues. Input is normalized/validated, duplicate attendee emails are rejected, and each checkout supports up to 50 attendees.
- Orders and registrations are created together in a database transaction. An event-row lock serializes seat/discount reservations across concurrent checkouts. Tickets stay **pending** until verified payment; pending tickets and legacy active tickets on unpaid orders do not grant replay/livestream access.
- Checkout reservations last 35 minutes. Capacity and discount usage include paid active tickets and unexpired pending reservations. Expired holds stop blocking new checkout even if an expiration webhook is delayed. A browser cancellation alone leaves the existing Stripe session available until expiration.
- All amounts are calculated/distributed in integer cents. Remainders use separate Stripe line prices so registration allocations, order total and Stripe amount match exactly. Subscriber pricing, event/ticket restrictions, code expiry and maximum uses are enforced server-side.
- Paid checkout requires both Stripe key and webhook setup before creating any order. Default `STRIPE_MODE=test` accepts only `sk_test_` keys. Live operation requires an explicit `STRIPE_MODE=live` and matching key. Test/live events and retrieved sessions must match the configured mode. Source credentials never belong in Git or chat.
- Stripe sessions have a per-order idempotency key, a stored session ID and a `nic360=events` metadata tag. Webhooks verify the unmodified raw body and Stripe signature, then retrieve the session from Stripe. The stored session, USD amount, mode and order must match, and payment must actually be **paid**. A signed `completed` event with unpaid status cannot activate tickets.
- Payment fulfillment locks the order, rechecks inventory, creates/reuses colleague accounts, activates tickets, records payment and queues invitations atomically. Concurrent/repeated events do not create more accounts/tickets/jobs. A late paid session whose reservation was reallocated requires staff review rather than overselling; it is not automatically refunded.
- Free and 100%-off orders use the same fulfillment/invitation path without calling Stripe. Existing account holders retain their existing passwords and receive no set-password invite. Newly created colleagues get a queued **Your Nicotine360 event invitation** email with their reader reset-password link.
- The persistent `event-invitations` worker runs each minute. Sent invitations are recorded per registration; retries skip those. Failed jobs retry three times with exponential backoff, and order errors appear in Operational alerts. As with account email, beta safe mode redirects invitations to `cmoll@nicotineresource.org`. A process crash after email acceptance but before recording its sent timestamp can still repeat that particular invitation on retry; this is not an exactly-once mail guarantee.
- Stripe session expiration cancels pending tickets/order idempotently; it never cancels a paid order. Free-order activation does not mark paid until the entire transaction commits. Historical orders/registrations are not rewritten by the schema migration.

## Existing-database deployment

Apply the additive migration before deploying:

```sh
pnpm exec tsx migration/prepareEventCheckout.ts
pnpm exec tsx migration/prepareEventCheckout.ts --apply
```

It adds the pending registration enum, order session/expiry/error fields, invitation fields and queued-task enum values. It does not change existing reader, order or registration rows. Both rollback preview and repeat application were rehearsed.

## Real Stripe test-mode setup

1. Add the account's sandbox/test `sk_test_…` key to `STRIPE_SECRET_KEY` on the beta app. Set `STRIPE_MODE=test`; keep `EMAIL_SAFE_MODE=on`. Railway calls this beta environment `production`.
2. Create a **test-mode snapshot webhook endpoint** at `https://beta.nicotine360.org/api/stripe/webhook`, using API version `2026-09-30.endive` to match the installed SDK. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`. Save its `whsec_…` signing secret directly to Railway as `STRIPE_WEBHOOK_SECRET` and redeploy. No live endpoint/credentials should be changed.
3. Create a temporary event, verified fixture buyer/colleague addresses and test discount codes. Use real hosted Stripe Checkout with Stripe's documented test card, never a real card. Complete a successful payment, try a decline and browser cancellation, and verify order/ticket states in the CMS.
4. Confirm receipt of Stripe's real signed event and queued colleague invitation at the safe mailbox. Exercise a valid discount, invalid/expired/wrong-event/ticket codes, a limited-use code and a comped/free ticket. Use a rounding-sensitive three-ticket order.
5. Redeliver the same actual Stripe event, including concurrent redelivery. Verify unchanged order/payment timestamp, one colleague account, one ticket each, one invitation job and no extra invitations. Separately exercise session expiration and confirm inventory/code reservation release.
6. Expire remaining open test sessions and remove fixture jobs/registrations/orders/discounts/event/accounts. Keep minimal payment/event IDs as private test evidence. Leave the beta test webhook configured and all email safety controls on.

Official references: [Stripe fulfillment and duplicate/concurrent calls](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted), [webhook signatures/retries](https://docs.stripe.com/webhooks), [test cards and declines](https://docs.stripe.com/testing).

## Regression verification

Offline tests cover real Stripe HMAC validation, invalid signatures, retryable fulfillment failure and test/live isolation. Disposable PostgreSQL integration tests cover pending access, exact cent allocation, concurrent seat/code reservation, subscriber pricing, code restrictions, duplicate fulfillment, new/existing colleagues, partial invitation retry, free/comped fulfillment, session mismatch/unpaid refusal, expiration and late-payment capacity protection. Email and Stripe requests are mocked in integration tests; no automated regression sends email or charges a card.

CI runs the checkout integration suite in a disposable PostgreSQL database with `CHECKOUT_INTEGRATION=1`. The suite refuses non-loopback/non-`_test` targets. No integration fixtures are inserted into the working or beta database by these tests.
