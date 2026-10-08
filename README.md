# Nic360

Payload CMS 3 + Next.js rebuild of Nicotine360. See [CLAUDE.md](./CLAUDE.md) for the project brief and [docs/entity-map.md](./docs/entity-map.md) for field-level detail. Build order and "done when" criteria for each milestone are in CLAUDE.md.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URI at minimum; everything else has a dev-safe default
docker compose up -d   # local Postgres on :5432
pnpm seed               # wipes and fills every collection with placeholder data
pnpm dev                 # http://localhost:3000
```

Admin panel: `/admin`. Every seeded account's password is `ChangeMe123!` (printed by `pnpm seed`).

Without `MANDRILL_SMTP_HOST`/`MANDRILL_API_KEY` set, account emails (verification, password reset) are logged instead of sent — fine for local dev.

## Status

### Milestone 1: accounts and access

- Collections: `staff` (editor/gatekeeper/admin roles), `users` (readers), `access-providers`, `media`.
- `src/access/readerPlan.ts` is the one place that decides a reader's effective plan (none/base/premium) from their Access Provider's status, plan and license expiry — every `access.read` function and protected route calls it rather than re-deriving the logic.
- `src/hooks/assignAccessProviderOnVerify.ts` auto-attaches a verified reader to the Access Provider whose `allowedDomains` matches their email.
- `/access-check` renders the "what can this user read" table from `pnpm seed`'s data — the milestone's done-when page.
- `/account` is the reader-facing profile page; publication email preferences are stubbed until Milestone 4.

### Milestone 2: excerpts

- Taxonomies: `sectors`, `products` (flat), `subjects` (tree via self-relationship), `locations` (region > country > state > city hierarchy), `sources`.
- Content: `articles`, `bills` (Content/Index tabs, `actions` array), `trademarks` (unindexed, image required).
- `src/access/excerptAccess.ts`: Articles/Bills are publicly readable at the collection level (titles/teasers for anyone) with the body fields (`excerpt`, `abstract`, `fullText`) gated behind `canReadFullContent` (Base+ or staff); Trademarks have no public teaser, so the whole collection requires Base+.
- Front end: `/articles`, `/bills` (filterable by sector/product/subject/location, via `src/lib/excerptFilters.ts`) and `/trademarks` (no filters, per the entity map), each with detail pages.
- `pnpm seed` fills ~50 excerpts (25 articles, 15 bills, 10 trademarks) across the taxonomy.

### Milestone 3: data and guides

- `datasets` (staff-defined columns, each with a stable `key` generated from its label), `dataset-rows` (JSON values, hidden from the admin nav, Premium-gated), `countries` (reference list for `country`-type columns, matched by name/alias/ISO code on import).
- `guides` + `guide-files` (protected PDFs, served only through Payload's access-checked file route — Base+ required, same as the entity map's "no public URL" requirement).
- Import: `src/lib/datasetImport.ts` (`parseCsv`, `suggestMapping`, `commitImport`) is the one shared pipeline used by **both** the staff upload wizard and `pnpm seed`, so seeding is a genuine exercise of the same code path, not a shortcut. Staff reach the wizard from a dataset's admin edit screen ("Import data →", via `admin.components.edit.beforeDocumentControls`) or directly at `/staff/datasets/[id]/import`; it previews headers/sample rows, lets staff adjust the header→column mapping, then confirms (bulk-inserting through the Local API — a production-scale import should go through the DB adapter directly instead, see the comment in `commitImport`).
- **CSV only, not XLSX**: the npm `xlsx` package's last published version (0.18.5) is stale and carries known advisories; `papaparse` covers our actual need (we only need to read our own sample files and reader-facing exports) without that risk. "Excel download" is a CSV, which Excel opens natively.
- `/datasets` (cards) → `/datasets/[slug]` (AG Grid, Premium-gated, CSV download) via `/api/datasets/[id]/rows` and `/api/datasets/[id]/export`. `/guides` → `/guides/[slug]` (Base+ gated).
- `pnpm seed` imports two real sample spreadsheets (`docs/sample-data/*.csv`) into two datasets, and publishes two guides.

Next: Milestone 4 (Publications and Mailchimp).
