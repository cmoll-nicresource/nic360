# Nic360 Remake: project brief

Read this first. Field-level detail for every entity lives in `docs/entity-map.md`; this file says what we're building, how, and in what order. When the two disagree, the entity map wins on fields and this file wins on process.

## What this is

A rebuild of Nicotine360 (nicotine360.org), a subscription news and intelligence site for the nicotine and tobacco industry, run by a 501(c)(6) trade organization with five staff. Users are site account holders; subscribers have a subscription through an access provider, and attendees are users registered for a specific conference. NRC membership is not a site distinction. See [docs/terminology.md](docs/terminology.md).

**Original goal: a working skeleton prototype.** The five milestones below are complete. The project now includes migrated data, refreshed user/staff interfaces, trade/trademark PDFs and live queued SES newsletters. Use [docs/project-status.md](docs/project-status.md) for current completed work and next steps, `docs/entity-map.md` for the feature map, and individual runbooks for operations. Beta trade setup and report fixes are complete; the user reported successful generation. Broader acceptance checks remain separate from that successful workflow.

## Stack

The user experience refresh (dashboard, discovery, publications/guides/events, complete dataset exploration and exports) is documented in `docs/frontend-experience.md`. Its current behavior supersedes the older design-review checklist.

The current staff interface lives under `/admin`, including trade reports, dataset imports, event management and user access diagnostics. See `docs/admin-workspace.md` for the role-aware dashboard, custom-view shell, legacy redirects and verification notes.

| Part | Choice |
|---|---|
| App | Payload CMS 3 inside a Next.js (App Router) app, TypeScript throughout |
| Database | Postgres via `@payloadcms/db-postgres` |
| Hosting | Railway (app service + Postgres) |
| File storage | S3-compatible bucket via `@payloadcms/storage-s3` (AWS S3 or Cloudflare R2; endpoint is config). Local disk in development |
| Payments | Stripe (event tickets only) |
| Account email | AWS SES (through Payload's nodemailer email adapter; same credentials/system as the publication-issue sender below) |
| Newsletters | AWS SES, queued private sends with delivery logs, signed unsubscribe and verified SNS feedback; see `docs/newsletter-delivery.md`. Mailchimp is historical only |
| Data grids | AG Grid (Community) on the front end |
| Background work | Payload jobs queue with scheduled tasks |

## Core rules

**Two kinds of login, kept apart**
- `users`: site accounts, with optional access provider subscriptions and conference registrations.
- `staff`: the five employees who use the CMS admin. Only `staff` can log in to `/admin`.

**Staff roles** (each includes the ones above it)
- `editor` (all staff): create, edit, publish and send all content.
- `gatekeeper` (2 staff): plus manage Users, Access Providers, discount codes, registrations, EmailFlags.
- `admin` (Papa): plus manage Staff and global settings.

**User access** is decided by content type and the user's company — with one per-item exception, Guides:

| Content | Who can read |
|---|---|
| Excerpts (Articles, Bills, Trademarks) | Base or Premium |
| Publications and Issues | Base or Premium |
| Data (datasets, rows, downloads) | Premium |
| Guides | Premium by default; a specific guide can opt into Base access via its own `requiresPremium` field |
| An Event's restricted content (replays) | Users registered for that event |

- A user's plan comes from their Access Provider: `plan` (None · Base · Premium), with `status` Trial or Live and `licenseExpiresAt` in the future or empty. Anything else means no access.
- Premium includes Base.
- Users with no provider (event attendees) see only events they registered for.
- Put this in one helper (`src/access/subscriptionPlan.ts`) that every `access.read` function and protected route uses. Public listing pages may show titles and teasers; full content checks the plan.

## Collections by milestone

Build in this order. Each milestone ends with seed data and pages you can click through.

**1. Accounts and access**
- `staff`, `users`, `access-providers`, `media`.
- Users join a provider automatically on email verification when their domain or address is in the provider's `allowedDomains`.
- Account page: profile, plus publication email choices (stubbed until milestone 4).
- Done when: seeded companies with each plan and status, users under each, and a test page that shows "what can this user read" for any user.

**2. Excerpts**
- Taxonomies: `sectors`, `products`, `subjects` (tree), `locations` (tree: region > country > state > city), `sources`.
- `articles`, `bills` (with `actions` array), `trademarks`.
- Front end: list pages with filters by index terms and location, and detail pages, all gated by plan.
- Done when: about 50 placeholder excerpts across all three types render with filters.

**3. Data and guides**
- `datasets` (column definitions), `dataset-rows` (JSON values, hidden from admin nav), `countries`.
- Custom admin import view: upload a spreadsheet, map its headers, preview, confirm. "Replace existing rows" is on by default.
- AG Grid page per dataset, with CSV/Excel download (Premium).
- `guides` with a protected `guide-files` PDF collection.
- Done when: two seeded datasets (e.g. *Cigarette Market Share by Company*) import from sample spreadsheets and display.

**4. Publications and Mailchimp**
- `publications` (selection and grouping rules, Mailchimp ids, `generator`), `publication-issues` (three formats), `email-flags`, global `mailchimp-settings`.
- "Build from rules" on excerpt-list issues.
- Send test / Send with a confirmation dialog.
- One-way preference sync and the unsubscribe webhook, all through the Mailchimp interface (simulated).
- Trademark report job: pull USPTO data, generate weekly and monthly PDFs, create draft issues, and log to `trademark-import-runs`. A fixture file can stand in for the USPTO feed at first.
- Done when: an editor can build an issue from rules, press Send, and see the rendered campaign HTML and target segment in the simulated outbox.

**5. Events and ticketing**
- Channels in code (`src/config/channels.ts`: ATNF, GTNF, InFocus).
- `events` (ticket types, days, sponsors), `sessions`, `speakers`, `sponsors`, `discount-codes`, `orders`, `event-registrations`.
- Stripe Checkout in test mode, with a webhook marking orders paid. Buyers can purchase tickets for colleagues, which invites them by email.
- Done when: a test purchase of two tickets with a discount code creates an order and two registrations, and the attendees can see the event's replay.

## Historical Mailchimp prototype

The following describes the completed original prototype. Current publication delivery uses SES; do not implement live Mailchimp sending or configure it as a standing audience mirror. The CMS owns consent and suppression. See `docs/newsletter-delivery.md` for sending, recovery, tests and AWS prerequisites.

There is no Mailchimp test audience yet. Define a `MailchimpClient` interface (`upsertMember`, `createCampaign`, `sendCampaign`, `sendTest`, and webhook parsing) with two implementations, chosen by env `MAILCHIMP_MODE=simulated|live`:
- `simulated`: writes every call to a `mailchimp-outbox` collection (admin-only). Each entry holds the payload, the target segment, and for campaigns the **full rendered HTML**, viewable in the admin. This is how campaigns get reviewed until a test audience exists.
- `live`: real API calls. Leave it stubbed with TODOs if that's quicker.

Our site is the source of truth for who receives what. Mailchimp only mirrors it, except for unsubscribes (see the entity map, EmailFlag).

## US Tobacco Trade Barometer

A monthly, upload-triggered report (not scheduled): any editor uploads the two files Census emails each month at `/admin/trade-reports`, which loads them into a `ref`/`trade`/`report` Postgres schema set (same database, namespaced away from Payload's own tables), refreshes the US Imports/US Exports Datasets, and drafts the Trade Barometer as a PDF Publication Issue. See `docs/ttb-trade-report.md` for the numeric-conversion repair, tests, and verification. **Railway beta trade database prerequisites were restored and verified October 14, 2026. Report fixes are deployed to beta, and the user has reported successful generation; remaining acceptance work is tracked in docs/project-status.md. Never run the prototype's destructive schema.sql against an existing trade database.**

## Conventions

Trade report updates: the PDF cover contents link to internal chapter destinations. The upload job and preview renderer automatically enrich missing US-trade inputs with matching monthly FRED BOPTEXP/BOPTIMP/BOPGSTB figures for the report month; buildReport remains network-free. Figures are converted from millions to billions and labeled goods/services, BOP, seasonally adjusted. See the trade runbook for source-gap handling, manual overrides, source snapshots, and tests.

Missing TRQ inputs are also fetched automatically from the latest weekly CBP Commodity Status PDF. The date lookup checks the last 14 US Eastern calendar dates to handle holiday shifts. PDF.js extracts only ID-prefix-24 / exact-Tobacco rows; headers, units, countries, quota periods, exclusions and percentages are validated. The section shows its weekly release date even when the tobacco report month is older. Source failures stop PDF generation; explicit complete manual inputs override automation. All six release dates use the generation date in US Eastern, the tobacco lead-in is removed, duty-free summaries are finished prose, and readiness checks reject unresolved editorial markers. See the trade runbook and real-PDF fixture tests before changing the parser.

- One file per collection in `src/collections/`. Shared field builders (index terms, excerpt core) live in `src/fields/`. Access functions go in `src/access/`, hooks in `src/hooks/`.
- Field names and types follow `docs/entity-map.md`. If a field has to change, update the entity map in the same commit.
- Use Payload drafts (`versions.drafts`) on content collections. Use `join` fields for reverse lists instead of storing both sides.
- Seed scripts: never reset the working or hosted database. The demo reset requires a dedicated loopback `nic360_*_demo`/`nic360_*_test` database, `ALLOW_DESTRUCTIVE_LOCAL_SEED=true`, and `pnpm seed --reset-local-demo`; see `docs/import-and-access-safety.md`.
- Tests: `pnpm test` (Vitest, `src/**/*.test.ts`) covers pure logic — no DB or network. Add a test alongside any new pure function with real edge cases (parsing, pricing, classification, access rules), not just UI/collection code.
- Secrets come only from env: `DATABASE_URI`, `PAYLOAD_SECRET`, `S3_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SES_*`, `MAILCHIMP_API_KEY`, `MAILCHIMP_MODE`. Keep `.env.example` up to date.
- Email safety: real migrated users exist on beta. Account/operations email redirects to the safe mailbox by default; newsletter audience sends are blocked while safe mode is on. SES has production sending access; its sandbox is not a backstop. Keep `EMAIL_SAFE_MODE=on` until a deliberately approved rollout. See `docs/newsletter-delivery.md`.
- Keep it simple: this is a prototype for a five-person team. Prefer Payload built-ins over custom infrastructure.

## Historical prototype exclusions

The list below describes the original prototype only. Migration and the visual refresh were subsequently completed. Use [docs/project-status.md](docs/project-status.md) for current next steps. Mailchimp live sending remains excluded; SES is the implemented sender.

- Migrating data, users or passwords from the old site.
- Redirects (only a couple of pages are crawlable).
- Final visual design.
- Live Mailchimp sending.
- Follow-up process for EmailFlags (beyond the queue and Re-add button).

## Still to decide (don't block on these; use the default)

| Question | Default for the prototype |
|---|---|
| How articles and bills get in (StateNet import?) | Manual entry in the admin |
| Site search | Payload search plugin across excerpts, guides and publications |
| Homepage and other site pages | A simple `pages` collection with a few blocks, plus a homepage global |
