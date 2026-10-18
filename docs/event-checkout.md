# Event checkout and Stripe verification

October 16, 2026. Checkout hardening is deployed and **real hosted Stripe sandbox payment, signed webhook delivery, colleague invitations, discounts, declines, cancellation, expiration and concurrent duplicate handling are verified on beta**. The dedicated Nic360 Beta sandbox and beta-only credentials do not change the existing site's live Stripe integration. `STRIPE_MODE=test` and `EMAIL_SAFE_MODE=on` remain enabled.

## Behavior

- Active, verified users can buy for themselves and colleagues. Input is normalized/validated, duplicate attendee emails are rejected, and each checkout supports up to 50 attendees.
- Orders and registrations are created together in a database transaction. An event-row lock serializes seat/discount reservations across concurrent checkouts. Tickets stay **pending** until verified payment; pending tickets and legacy active tickets on unpaid orders do not grant replay/livestream access.
- Checkout reservations last 35 minutes. Capacity and discount usage include paid active tickets and unexpired pending reservations. Expired holds stop blocking new checkout even if an expiration webhook is delayed. A browser cancellation alone leaves the existing Stripe session available until expiration.
- All amounts are calculated/distributed in integer cents. Remainders use separate Stripe line prices so registration allocations, order total and Stripe amount match exactly. Subscriber pricing, event/ticket restrictions, code expiry and maximum uses are enforced server-side.
- Paid checkout requires both Stripe key and webhook setup before creating any order. Default `STRIPE_MODE=test` accepts only `sk_test_` keys. Live operation requires an explicit `STRIPE_MODE=live` and matching key. Test/live events and retrieved sessions must match the configured mode. Source credentials never belong in Git or chat.
- Stripe sessions have a per-order idempotency key, a stored session ID and a `nic360=events` metadata tag. Webhooks verify the unmodified raw body and Stripe signature, then retrieve the session from Stripe. The stored session, USD amount, mode and order must match, and payment must actually be **paid**. A signed `completed` event with unpaid status cannot activate tickets.
- Payment fulfillment locks the order, rechecks inventory, creates/reuses colleague accounts, activates tickets, records payment and queues invitations atomically. Concurrent/repeated events do not create more accounts/tickets/jobs. A late paid session whose reservation was reallocated requires staff review rather than overselling; it is not automatically refunded.
- Free and 100%-off orders use the same fulfillment/invitation path without calling Stripe. Existing account holders retain their existing passwords and receive no set-password invite. Newly created colleagues get a queued **Your Nicotine360 event invitation** email with their user reset-password link.
- The persistent `event-invitations` worker runs each minute. Sent invitations are recorded per registration; retries skip those. Failed jobs retry three times with exponential backoff, and order errors appear in Operational alerts. As with account email, beta safe mode redirects invitations to `cmoll@nicotineresource.org`. A process crash after email acceptance but before recording its sent timestamp can still repeat that particular invitation on retry; this is not an exactly-once mail guarantee.
- Stripe session expiration cancels pending tickets/order idempotently; it never cancels a paid order. Free-order activation does not mark paid until the entire transaction commits. Historical orders/registrations are not rewritten by the schema migration.

## Existing-database deployment

Apply the additive migration before deploying:

```sh
pnpm exec tsx migration/prepareEventCheckout.ts
pnpm exec tsx migration/prepareEventCheckout.ts --apply
```

It adds the pending registration enum, order session/expiry/error fields, invitation fields and queued-task enum values. It does not change existing user, order or registration rows. Both rollback preview and repeat application were rehearsed.

## Real Stripe test-mode setup

1. Add the account's sandbox/test `sk_test_…` key to `STRIPE_SECRET_KEY` on the beta app. Set `STRIPE_MODE=test`; keep `EMAIL_SAFE_MODE=on`. Railway calls this beta environment `production`.
2. Create a **test-mode snapshot webhook endpoint** at `https://beta.nicotine360.org/api/stripe/webhook`, using API version `2026-09-30.endive` to match the installed SDK. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `checkout.session.expired`. Save its `whsec_…` signing secret directly to Railway as `STRIPE_WEBHOOK_SECRET` and redeploy. No live endpoint/credentials should be changed.
3. Create a temporary event, verified fixture buyer/colleague addresses and test discount codes. Use real hosted Stripe Checkout with Stripe's documented test card, never a real card. Complete a successful payment, try a decline and browser cancellation, and verify order/ticket states in the CMS.
4. Confirm receipt of Stripe's real signed event and queued colleague invitation at the safe mailbox. Exercise a valid discount, invalid/expired/wrong-event/ticket codes, a limited-use code and a comped/free ticket. Use a rounding-sensitive three-ticket order.
5. Redeliver the same actual Stripe event, including concurrent redelivery. Verify unchanged order/payment timestamp, one colleague account, one ticket each, one invitation job and no extra invitations. Separately exercise session expiration and confirm inventory/code reservation release.
6. Expire remaining open test sessions and remove fixture jobs/registrations/orders/discounts/event/accounts. Keep minimal payment/event IDs as private test evidence. Leave the beta test webhook configured and all email safety controls on.

Official references: [Stripe fulfillment and duplicate/concurrent calls](https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted), [webhook signatures/retries](https://docs.stripe.com/webhooks), [test cards and declines](https://docs.stripe.com/testing).

## Regression verification

### Hosted Stripe sandbox verification — October 16

The beta app was configured with the user-provided sandbox secret key and a new test-only snapshot webhook. Its signing secret was transferred directly into Railway without printing it or saving a local copy. The configuration deployment `368b0866-d1cc-42b5-8e49-36789648a8f2` succeeded.

- A real hosted Checkout used Stripe's documented test Visa card for three $1.01 tickets with a 25% discount. Stripe charged **227 test cents**, with line items of two 76-cent tickets and one 75-cent ticket. The order subtotal was $3.03, discount $0.76, and total $2.27. No real funds moved.
- Before payment, all three tickets were pending with zero paid amounts, the new colleague account did not exist, and event access was denied. Stripe's actual signed `checkout.session.completed` request returned HTTP 200 at `2026-10-16T13:28:26Z`; the browser returned to the branded paid confirmation page. Only the webhook route performs Stripe session fulfillment.
- Payment activated exactly three registrations, retained the existing colleague account and created exactly one new colleague. The new colleague gained event access. The automatic invitation worker recorded transport acceptance at `2026-10-16T13:29:00.292Z`, redirected to `cmoll@nicotineresource.org`; existing accounts received no set-password invitations. This verifies transport acceptance, not human inbox inspection.
- The actual completion event was retrieved from Stripe and replayed three times concurrently with freshly generated valid webhook signatures. All returned 200. Paid timestamp, payment reference, registration IDs, colleague ID/count and invitation timestamp stayed unchanged. These duplicate requests came from the test harness; the original completion and expiration deliveries came from Stripe.
- The documented decline card was rejected by hosted Checkout. A separate hosted cancellation returned to beta with `cancelled=1`. Both orders/tickets remained pending with zero paid amounts. Expiring both sessions through Stripe produced actual signed expiration deliveries, both HTTP 200 at `2026-10-16T13:30:42Z`; both unpaid orders/tickets became cancelled and the paid order remained unchanged. Reserved inventory fell from five tickets to the three paid tickets, and the three-use paid discount correctly had zero uses left.
- Unsigned Stripe requests now return 400 rather than the previous missing-configuration 503. The completed and two expiration events had zero pending webhook deliveries. Remaining fixture sessions were expired; fixture accounts, event, codes, orders, tickets, jobs and temporary SSH credentials were removed. Stripe retains its normal sandbox payment/event history. No migrated user or live Stripe resource was used.

Minimal sandbox evidence: completed event `evt_1URBBNJ3jc98lPFM4Fh5McNp`; expiration events `evt_1URBDZJ3jc98lPFMI1UxpxrV` and `evt_1URBDaJ3jc98lPFM3yXgGdfz`. These identifiers are not API credentials. The beta test webhook remains configured for future sandbox testing.

### Earlier free/comped verification

Controlled beta browser/API verification used one temporary verified buyer, one new colleague, an internal test event and temporary discount codes. Verified user authorization, missing Stripe setup rejecting paid checkout before creating an order, invalid/expired/ticket-restricted/exhausted codes, duplicate-attendee rejection, comped and zero-price fulfillment, the paid success page and colleague event access. The automatic queue accepted one actual **Your Nicotine360 event invitation** at `2026-10-16T13:12:00.445Z`, redirected to `cmoll@nicotineresource.org` by safe mode. Repeating fulfillment and the invitation worker preserved the sent timestamp and did not send another invitation. Fixtures and temporary SSH access were removed. No real card or migrated user was used.

### Automated regression coverage

Offline tests cover real Stripe HMAC validation, invalid signatures, retryable fulfillment failure and test/live isolation. Disposable PostgreSQL integration tests cover pending access, exact cent allocation, concurrent seat/code reservation, subscriber pricing, code restrictions, duplicate fulfillment, new/existing colleagues, partial invitation retry, free/comped fulfillment, session mismatch/unpaid refusal, expiration and late-payment capacity protection. Email and Stripe requests are mocked in integration tests; no automated regression sends email or charges a card.

CI runs the checkout integration suite in a disposable PostgreSQL database with `CHECKOUT_INTEGRATION=1`. The suite refuses non-loopback/non-`_test` targets. No integration fixtures are inserted into the working or beta database by these tests.
