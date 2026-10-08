# Nic360 Remake: project brief

Read this first. Field-level detail for every entity lives in `docs/entity-map.md`; this file says what we're building, how, and in what order. When the two disagree, the entity map wins on fields and this file wins on process.

## What this is

A rebuild of Nicotine360 (nicotine360.org), a subscription news and intelligence site for the nicotine and tobacco industry, run by a 501(c)(6) trade organization with five staff. Readers get access through their employer's company-wide subscription (mostly via membership dues) or by buying a ticket to an event.

**Current goal: a working skeleton prototype.** Every collection exists in Payload with its real fields and access rules, the site renders it, and seed scripts fill it with placeholder data. Data migration from the old site, redirects and visual polish come later.

## Stack

| Part | Choice |
|---|---|
| App | Payload CMS 3 inside a Next.js (App Router) app, TypeScript throughout |
| Database | Postgres via `@payloadcms/db-postgres` |
| Hosting | Railway (app service + Postgres) |
| File storage | S3-compatible bucket via `@payloadcms/storage-s3` (AWS S3 or Cloudflare R2; endpoint is config). Local disk in development |
| Payments | Stripe (event tickets only) |
| Account email | Mandrill (SMTP through Payload's nodemailer email adapter) |
| Newsletters | Mailchimp Marketing API, behind an interface with a **simulated** implementation (see Mailchimp below) |
| Data grids | AG Grid (Community) on the front end |
| Background work | Payload jobs queue with scheduled tasks |

## Core rules

**Two kinds of login, kept apart**
- `users`: readers (members and event attendees).
- `staff`: the five employees who use the CMS admin. Only `staff` can log in to `/admin`.

**Staff roles** (each includes the ones above it)
- `editor` (all staff): create, edit, publish and send all content.
- `gatekeeper` (2 staff): plus manage Users, Access Providers, discount codes, registrations, EmailFlags.
- `admin` (Papa): plus manage Staff and global settings.

**Reader access** is decided by content type and the reader's company, never per item:

| Content | Who can read |
|---|---|
| Excerpts (Articles, Bills, Trademarks) | Base or Premium |
| Guides, Publications and Issues | Base or Premium |
| Data (datasets, rows, downloads) | Premium |
| An Event's restricted content (replays) | Users registered for that event |

- A user's plan comes from their Access Provider: `plan` (None · Base · Premium), with `status` Trial or Live and `licenseExpiresAt` in the future or empty. Anything else means no access.
- Premium includes Base.
- Users with no provider (event attendees) see only events they registered for.
- Put this in one helper (`src/access/readerPlan.ts`) that every `access.read` function and protected route uses. Public listing pages may show titles and teasers; full content checks the plan.

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

## Mailchimp (simulated for now)

There is no Mailchimp test audience yet. Define a `MailchimpClient` interface (`upsertMember`, `createCampaign`, `sendCampaign`, `sendTest`, and webhook parsing) with two implementations, chosen by env `MAILCHIMP_MODE=simulated|live`:
- `simulated`: writes every call to a `mailchimp-outbox` collection (admin-only). Each entry holds the payload, the target segment, and for campaigns the **full rendered HTML**, viewable in the admin. This is how campaigns get reviewed until a test audience exists.
- `live`: real API calls. Leave it stubbed with TODOs if that's quicker.

Our site is the source of truth for who receives what. Mailchimp only mirrors it, except for unsubscribes (see the entity map, EmailFlag).

## Conventions

- One file per collection in `src/collections/`. Shared field builders (index terms, excerpt core) live in `src/fields/`. Access functions go in `src/access/`, hooks in `src/hooks/`.
- Field names and types follow `docs/entity-map.md`. If a field has to change, update the entity map in the same commit.
- Use Payload drafts (`versions.drafts`) on content collections. Use `join` fields for reverse lists instead of storing both sides.
- Seed scripts: `pnpm seed` resets and fills every collection with realistic placeholder data (tobacco and nicotine industry flavored, no real personal data).
- Secrets come only from env: `DATABASE_URI`, `PAYLOAD_SECRET`, `S3_*`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MANDRILL_*`, `MAILCHIMP_API_KEY`, `MAILCHIMP_MODE`. Keep `.env.example` up to date.
- Keep it simple: this is a prototype for a five-person team. Prefer Payload built-ins over custom infrastructure.

## Out of scope for now

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
