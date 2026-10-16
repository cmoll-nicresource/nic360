# Nic360

Current completed work and next steps: [project checklist](docs/project-status.md). Operational monitoring: [alerts runbook](docs/operations.md). Older milestone descriptions below are project history.

Scheduled backups and the October 16 isolated restore rehearsal are documented in [backup and recovery](docs/backup-recovery.md).

Payload CMS 3 + Next.js rebuild of Nicotine360. See [CLAUDE.md](./CLAUDE.md) for the project brief and [docs/entity-map.md](./docs/entity-map.md) for field-level detail. Build order and "done when" criteria for each milestone are in CLAUDE.md.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URI at minimum; everything else has a dev-safe default
docker compose up -d   # local Postgres on :5432
# Optional disposable demo data: see docs/import-and-access-safety.md
pnpm dev                 # http://localhost:3000
```

Admin panel: `/admin`. Staff tasks are grouped into imports/reports, publishing and operations; see [docs/admin-workspace.md](./docs/admin-workspace.md) for routes, permissions and verification. Every seeded account's password is `ChangeMe123!` (printed by `pnpm seed`).

## Testing

The current reader layouts, search, dataset explorer and access checks are described in [docs/frontend-experience.md](./docs/frontend-experience.md).

Dataset transactions, PDF permissions, webhook verification, and the guarded local demo reset are documented in [docs/import-and-access-safety.md](./docs/import-and-access-safety.md). `pnpm seed` refuses the working database; it requires a dedicated local demo/test database and explicit reset switches.

`pnpm test` runs the offline Vitest suite, including trade-report database-response regressions and actual PDF table-layout checks. `pnpm test:watch` reruns on change. `pnpm test:trade-report` opts into read-only integration checks against local Postgres with the restored trade history; these are skipped in the offline suite. Collection access rules, hooks and HTTP flows still require manual verification.

`pnpm trade:check` checks trade prerequisites without initializing Payload or changing the database. `pnpm trade:render 2026 8` generates a local PDF preview under `tmp/` from a read-only snapshot. Setup, verification, and the guarded production restore plan are in [docs/ttb-trade-report.md](./docs/ttb-trade-report.md).

Without `SES_ACCESS_KEY_ID`/`SES_SECRET_ACCESS_KEY` set, account emails (verification, password reset, event invites) print to the console instead of sending — fine for local dev. In any environment where they are set, real migrated user data means every outgoing account email is still redirected to a safe address by default (`EMAIL_SAFE_MODE`, on unless explicitly set to `off`) — see `src/lib/emailSafeMode.ts`. Without `STRIPE_SECRET_KEY`, event ticket checkout fails closed before creating a paid order (everything up to and including 100%-off/free tickets still works, since those skip Stripe entirely).

## Status

### Milestone 1: accounts and access

- Collections: `staff` (editor/gatekeeper/admin roles), `users` (readers), `access-providers`, `media`.
- `src/access/readerPlan.ts` is the one place that decides a reader's effective plan (none/base/premium) from their Access Provider's status, plan and license expiry — every `access.read` function and protected route calls it rather than re-deriving the logic.
- `src/hooks/assignAccessProviderOnVerify.ts` auto-attaches a verified reader to the Access Provider whose `allowedDomains` matches their email.
- `/admin/access-check` shows effective reader access for gatekeeper/admin staff. The former `/access-check` URL redirects there.
- `/account` is the reader-facing profile page, including publication email preferences for eligible subscribers.

### Milestone 2: excerpts

- Taxonomies: `sectors`, `products` (flat), `subjects` (tree via self-relationship), `locations` (region > country > state > city hierarchy), `sources`.
- Content: `articles`, `bills` (Content/Index tabs, `actions` array), `trademarks` (unindexed, image optional when the USPTO image is unavailable).
- `src/access/excerptAccess.ts`: Articles/Bills are publicly readable at the collection level (titles/teasers for anyone) with the body fields (`excerpt`, `abstract`, `fullText`) gated behind `canReadFullContent` (Base+ or staff); Trademarks have no public teaser, so the whole collection requires Base+.
- Front end: `/articles`, `/bills` (keyword/date and sector/product/subject/location filters) and `/trademarks` (keyword/date filters), each with detail pages.
- `pnpm seed` fills ~50 excerpts (25 articles, 15 bills, 10 trademarks) across the taxonomy.

### Milestone 3: data and guides

- `datasets` (staff-defined columns, each with a stable `key` generated from its label), `dataset-rows` (JSON values, hidden from the admin nav, Premium-gated), `countries` (reference list for `country`-type columns, matched by name/alias/ISO code on import).
- `guides` require Premium by default; `requiresPremium: false` permits Base access to an individual guide. PDFs use the protected `guide-files` collection.
- Import: `src/lib/datasetImport.ts` (`parseCsv`, `suggestMapping`, `commitImport`) is the one shared pipeline used by **both** the staff upload wizard and `pnpm seed`, so seeding is a genuine exercise of the same code path, not a shortcut. Staff reach the wizard from a dataset's admin edit screen ("Import data →", via `admin.components.edit.beforeDocumentControls`) or directly at `/admin/datasets/[id]/import`; it previews headers/sample rows, lets staff adjust the header→column mapping, then confirms (bulk-inserting through the Local API — a production-scale import should go through the DB adapter directly instead, see the comment in `commitImport`).
- The generic dataset importer and reader exports use CSV (`papaparse`); "Excel download" is a CSV Excel can open. The separate Census trade uploader reads `.xls`/`.xlsx` with `xlsx`.
- `/datasets` (cards) → `/datasets/[slug]` (AG Grid, Premium-gated, CSV download) via `/api/datasets/[id]/rows` and `/api/datasets/[id]/export`. `/guides` → `/guides/[slug]` uses per-guide plan checks.
- `pnpm seed` imports two real sample spreadsheets (`docs/sample-data/*.csv`) into two datasets, and publishes two guides.

### Milestone 4: publications (original Mailchimp prototype; current sender is SES)

- `publications` (selection/grouping rules, Mailchimp ids, `generator`), `publication-issues` (three formats: excerpt list, PDF report, custom HTML — conditional fields per `format`), `email-flags`, `trademark-import-runs`, the `mailchimp-outbox` collection, and the `mailchimp-settings` global.
- `src/lib/mailchimp/` defines the `MailchimpClient` interface (`upsertMember`, `createCampaign`, `sendCampaign`, `sendTest`, `parseUnsubscribeWebhook`) with a `simulated` implementation (writes every call, including the full rendered campaign HTML and target segment, to `mailchimp-outbox`) and a stubbed `live` one, chosen by `MAILCHIMP_MODE`.
- `src/lib/publicationRules.ts` is "Build from rules": applies a publication's date window, include/exclude index-term filters (locations expand hierarchically — a rule for "United States" also matches "Pennsylvania", per the entity map), groups (region/country/primarySubject/sector/product/excerptType, with a second-level `thenGroupBy`) and sorts, producing `sections` ready to assign onto an Issue.
- `src/lib/issueEmail.ts` renders an Issue into the email template for its format. Both "Build from rules" and "Send"/"Send test" are buttons on the Issue's admin edit screen (`admin.components.edit.beforeDocumentControls`), calling `/api/publication-issues/[id]/build-from-rules` and `/api/publication-issues/[id]/send`; Send asks for confirmation and locks the issue against re-sending once it reports `sent`.
- Signed newsletter unsubscribe links and verified SES bounce/complaint events clear publication preferences and open an `EmailFlag`. Re-add restores prior choices transactionally after staff review. The legacy Mailchimp webhook is disabled while SES is the sender.
- `src/hooks/syncMailchimpOnUserChange.ts` defensively clears preferences for ineligible readers. It only mirrors changes to Mailchimp under the explicit legacy provider setting; SES uses the CMS audience directly.
- `src/lib/trademarkReportJob.ts`: a fixture stand-in (`docs/sample-data/uspto-fixture.json`), kept for offline testing. Superseded as the production path by `src/lib/tmog/*`, which streams and parses the real USPTO Trademark Official Gazette feed and runs weekly via Payload's job-queue cron (`src/jobs/tmogImportTask.ts`) — see `docs/entity-map.md`'s Trademark reports section for the full pipeline. Both share `src/lib/trademarkReportIssues.ts` for drafting the Weekly/Monthly report issues, and both log to `trademark-import-runs`. Manual triggers for either live at `/admin/trademark-reports`.
- `/publications` → `/publications/[slug]` → `/publications/[slug]/issues/[id]` (Base+ gated, draft issues hidden from readers).
- `pnpm seed` creates 5 publications, builds one issue from rules and sends it for real (same code path as the admin buttons) so the outbox has a genuine example, plus a ready-to-try draft issue, an EmailFlag, and sets two readers' preferences (exercising the sync hook).

### Milestone 5: events and ticketing

- Channels (`src/config/channels.ts`: ATNF, GTNF, InFocus) are code, not a collection. `events` (ticket types, days regenerated from the start/end range via a `beforeChange` hook, sponsors), `sessions` (agenda items, with a `replayEmbed` field gated to registered attendees once the event's Replay flag is on), `speakers`, `sponsors`, `discount-codes`, `orders`, `event-registrations` — the last three gatekeeper-managed per the brief.
- `src/lib/eventCheckout.ts` is the pricing/validation core (ticket price by attendance + subscriber status, discount-code validation including remaining-uses and event/ticket-type scoping) shared by the checkout route and `pnpm seed`'s demo purchase. `POST /api/events/[id]/checkout` creates a pending Order and its EventRegistrations, then either skips Stripe entirely for a 100%-off/free ticket (marks paid immediately) or creates a Stripe Checkout Session. `POST /api/stripe/webhook` marks the order paid on `checkout.session.completed` and, for any attendee without an account yet, creates one and invites them by email via Payload's built-in forgot-password email (`src/lib/orderFulfillment.ts`) — a genuine "buy for colleagues" flow, not a shortcut.
- `/events` → `/events/[id]` (ticket purchase form, agenda with replay gating) → `/events/[id]/success`. The account page lists a reader's registrations ("Products purchased").
- **Found and fixed while testing this milestone**: Payload's default password-reset email always links to `/admin/reset`, which only works for the `admin.user` collection (`staff`) — readers' reset tokens silently went nowhere. `users` now has its own `auth.forgotPassword.generateEmailHTML` pointing at a real `/reset-password/[token]` page, and the dev email fallback was changed from nodemailer's silent `jsonTransport` to a small transport that actually prints the email (both bugs had been invisible until this milestone's invite-by-email flow required reading one).
- `pnpm seed` seeds speakers, sponsors, three events across all three channels (one with `hasReplay`), sessions, a discount code, and a demo two-ticket purchase with that code applied (reusing the real pricing/validation functions, not hand-rolled numbers).

This completes every milestone in CLAUDE.md's original prototype scope. Later work added migration tooling, search, analytics, and the US Tobacco Trade Barometer. Live SES publication delivery now uses the Payload queue, per-recipient delivery records, signed unsubscribe links and deduplicated SNS events. Account emails use a separate SES transport. See [newsletter-delivery.md](docs/newsletter-delivery.md) for the additive schema update, AWS setup and controlled beta verification. Beta is configured for live tests with audience delivery blocked by email safe mode.

Current company/member migration exceptions and the EmailFlag deletion repair are tracked in [docs/migration-exceptions.md](docs/migration-exceptions.md). Apply its additive EmailFlag schema migration before deploying that relationship change to another existing database.
