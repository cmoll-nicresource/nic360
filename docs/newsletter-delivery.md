# SES publication delivery

Publication delivery uses AWS SES. Mailchimp is retained as a historical migration source; no live Mailchimp sender was implemented. Account email keeps its separate transport and sender address.

## Sending an issue

- **Send test** can preview a draft. In live mode it sends one private message; safe mode redirects it to `EMAIL_SAFE_MODE_REDIRECT_TO` (default `cmoll@nicotineresource.org`). The response reports the actual destination and SES message IDs. Test tags exclude its events from reader preference changes and issue statistics. Its unsubscribe links are explicitly inert test links.
- **Send** requires a published issue. Simulated mode records an SES outbox preview and leaves the issue unsent. Live mode requires complete configuration and `EMAIL_SAFE_MODE=off`; safe mode blocks audience sends rather than redirecting the entire audience to one mailbox.
- Live sends atomically claim the issue, save the exact subject/HTML/ad selection, record eligible recipients and queue a Payload job. Jobs run on the `newsletters` queue each minute on the persistent Railway app. One session-level Postgres advisory lock per issue also protects against overlapping workers across instances.
- The audience contains only active, verified readers who opted into that publication, currently have Base/Premium access, and have no unresolved suppression flag. Every result page is read, and addresses are deduplicated. Workers recheck eligibility, current address, consent and suppression immediately before sending each message.
- Each SES request has exactly one envelope recipient, a multipart HTML/plain-text message, a signed unsubscribe link and RFC8058 headers. Configuration-set tags carry `issueId`, `deliveryId` and `newsletterTest`. Sending is conservatively paced at one message per 1.1 seconds. Automatic SDK retries are disabled.
- Accepted delivery IDs are recorded in **Newsletter deliveries**. Definitive SES 4xx rejections are retryable; timeouts/disconnects and interrupted requests are **unknown** and are never resent automatically. A signed SES event matching the delivery, issue, recipient and message ID can reconcile an unknown acceptance.
- **Retry unsent recipients** uses the original content/audience and skips accepted, unknown and ineligible recipients. **Recover interrupted delivery** is available after ten minutes when there is no active worker. Recovery leaves interrupted SES requests unknown. Review these individually before deciding whether any manual follow-up is warranted.
- Issue `recipientCount` means SES-accepted messages, not proven inbox delivery. Delivery/open/click/bounce/complaint statistics come from verified events. Metrics are authoritative on the issue and synchronized into the latest editable version: a row-locking before-change hook carries current counters into every version save, while atomic event updates also update the latest version. This prevents queue/status/editorial saves from resetting webhook counters. Ad send impressions are recorded once after any acceptance, including partial sends; tests/previews do not count.

## Unsubscribe, bounces and complaints

Every live message has a footer link to `/api/newsletters/unsubscribe?token=…`. GET only shows a confirmation page, so link scanners do not unsubscribe readers. A signed RFC8058 one-click POST or the confirmation form clears publication preferences and records an EmailFlag in one database transaction. It never changes site access or account email. Tokens bind the reader ID, address and test scope; an old link cannot affect an account that changed email. Tokens do not expire; rotating the dedicated signing secret (or fallback Payload secret) invalidates existing links.

The SES endpoint `/api/ses/webhook` requires the configured SNS topic and a valid SNS signature on hosted sites, regardless of simulated/live mode. SNS confirmation URLs are constrained to the signed topic's AWS region and token. Event deduplication, suppression changes, counters and the event receipt share one transaction: retrying an SNS notification does not count it twice or lose a failed event. Open/Click counts are event totals, not unique readers.

Bounce/Complaint events clear newsletter preferences and open one unresolved EmailFlag. Flags under **Following up** still suppress. Prior preferences are retained for staff review. **Re-add** requires staff to confirm the reader wants to resume and the delivery problem is resolved. It restores previous preferences and resolves the flag atomically. AWS account-level suppression remains independent: review it in AWS before attempting to resume delivery; the CMS does not automatically remove complaint/bounce suppression there.

## AWS setup for beta

The October 15 preflight found beta sending credentials present in `us-east-1`, but no configuration-set name or SNS topic ARN configured. SES quota/identity listing is denied to that restricted key. The configured local AWS CLI was then used to verify that the same account has production sending enabled, healthy enforcement, a 50,000-message/day quota and 14-message/second rate, and verified `nicotine360.org` identity/DKIM with custom MAIL FROM `pubs.nicotine360.org`.

Created a dedicated configuration set **`nic360-beta-newsletters`**, enabled event destination **`nic360-beta-sns`**, and Standard SNS topic **`arn:aws:sns:us-east-1:226541720866:nic360-beta-newsletters`**. The topic retains its owner policy and adds SES publishing scoped to this account/configuration-set ARN. Existing email/SNS resources and identity defaults are unchanged. Beta uses `SES_MODE=live`, `EMAIL_SAFE_MODE=on`: controlled tests are allowed; audience sends remain blocked. Its HTTPS subscription is confirmed with raw message delivery disabled.

Controlled beta verification on October 15 sent one test through the actual admin endpoint to `cmoll@nicotineresource.org`; its signed SES Delivery event was received. Separate nonce-addressed AWS simulator accounts verified actual bounce/complaint suppression, retained prior choices, inert unsubscribe GET, repeat-safe one-click POST and unchanged site access. A full queued-worker test sent one simulator message and refused to resend its accepted ID. The test exposed version snapshots resetting metrics; the row-lock/version synchronization repair now has a regression covering concurrent webhook, queue, worker and editorial writes plus draft/published consistency. Temporary accounts, publications, issues, flags and jobs are removed after verification; minimal SES event receipts remain as evidence. No migrated reader was emailed.

1. In the SES console, select **US East (N. Virginia) / us-east-1**. Verify the configured newsletter From identity (`pubs@nicotine360.org`), DKIM, account sending status, and quota. Keep account-email identity settings unchanged; do not make the newsletter configuration set the domain-wide default.
2. Create an SES configuration set named `nic360-beta-newsletters` (or supply an existing name).
3. Create a **Standard** SNS topic in the same region, suggested name `nic360-beta-newsletters`. Allow `ses.amazonaws.com` to publish to this topic, restricted to your AWS account and this configuration-set ARN. AWS provides the exact [SNS publishing policy](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-add-event-destination-sns.html).
4. Add an enabled SNS event destination to the configuration set for **Send, Delivery, Bounce, Complaint, Open and Click**. SES applies the selected configuration set and tags to each newsletter [SendRawEmail request](https://docs.aws.amazon.com/ses/latest/APIReference/API_SendRawEmail.html).
5. Set the app's `SES_CONFIGURATION_SET` and `SES_SNS_TOPIC_ARN` to those exact values. Preserve `SES_MODE=simulated`, `EMAIL_SAFE_MODE=on` and the existing safe address until verification. The key must be authorized for `ses:SendRawEmail` using the newsletter identity/configuration set; account-email permissions alone do not establish this.
6. After the app has the topic ARN, create an HTTPS SNS subscription to `https://beta.nicotine360.org/api/ses/webhook`. Leave **raw message delivery disabled**. The app validates and confirms SNS's signed envelope; verify the subscription becomes confirmed in AWS.
7. Enable `SES_MODE=live` while keeping `EMAIL_SAFE_MODE=on`, then use **Send test** once. Confirm the actual safe address, accepted message ID, message appearance, plain-text alternative and unsubscribe headers, plus matching test Delivery event in **SES events**. This does not unlock reader sends.
8. Exercise bounce/complaint events with the AWS mailbox simulator under a controlled test configuration. Safe mode normally redirects every test, so simulator destinations require a process-scoped test override or an explicitly reviewed dedicated test environment; do not disable safe mode globally on beta just to run this test. A simulator test tag must not suppress real readers. Use isolated fixture accounts and signed notification processing to verify actual suppression behavior.
9. Real audience delivery needs a deliberate rollout with `EMAIL_SAFE_MODE=off` and sufficient SES production quota. This implementation task does not authorize sending an issue to the migrated audience.

AWS references: [event destinations](https://docs.aws.amazon.com/ses/latest/dg/using-configuration-sets.html), [one-click unsubscribe headers](https://docs.aws.amazon.com/ses/latest/dg/sending-email-subscription-management.html), [SNS event contents](https://docs.aws.amazon.com/ses/latest/dg/event-publishing-retrieving-sns-contents.html).

## Deployment and tests

Apply `migration/newsletterDelivery.sql` before deploying the code to an existing database:

```sh
pnpm exec tsx migration/prepareNewsletterDelivery.ts          # rolled-back preview
pnpm exec tsx migration/prepareNewsletterDelivery.ts --apply  # additive transaction
```

The migration adds the delivery/event logs, issue/version snapshot fields, job enum value and Payload lock references. It changes no existing readers, preferences, content or jobs. It is repeatable and uses a bounded lock wait.

Fast tests mock the SES transport while inspecting real MIME. PostgreSQL/Payload integration tests cover simultaneous sends, full snapshots, partial failures, unknown outcomes, recovery, duplicate events, transactional rollback, real signed unsubscribe POSTs and metrics preservation across versioned writes. They require `NEWSLETTER_INTEGRATION=1`, a loopback database and local file storage; all readers/issues/jobs/flags are temporary fixtures, verification email is disabled and SES is mocked. CI runs them on a disposable PostgreSQL service. No automated integration test sends email; the controlled beta verification above is separate.
