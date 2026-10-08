# Nic360

Payload CMS 3 + Next.js rebuild of Nicotine360. See [CLAUDE.md](./CLAUDE.md) for the project brief and [docs/entity-map.md](./docs/entity-map.md) for field-level detail. Build order and "done when" criteria for each milestone are in CLAUDE.md.

## Setup

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URI at minimum; everything else has a dev-safe default
docker compose up -d   # local Postgres on :5432
pnpm seed               # wipes and fills staff, users, access-providers, media
pnpm dev                 # http://localhost:3000
```

Admin panel: `/admin`. Every seeded account's password is `ChangeMe123!` (printed by `pnpm seed`).

Without `MANDRILL_SMTP_HOST`/`MANDRILL_API_KEY` set, account emails (verification, password reset) are logged instead of sent — fine for local dev.

## Status: Milestone 1 (accounts and access)

- Collections: `staff` (editor/gatekeeper/admin roles), `users` (readers), `access-providers`, `media`.
- `src/access/readerPlan.ts` is the one place that decides a reader's effective plan (none/base/premium) from their Access Provider's status, plan and license expiry — every future `access.read` function and protected route should call it rather than re-deriving the logic.
- `src/hooks/assignAccessProviderOnVerify.ts` auto-attaches a verified reader to the Access Provider whose `allowedDomains` matches their email.
- `/access-check` renders the "what can this user read" table from `pnpm seed`'s data — the milestone's done-when page.
- `/account` is the reader-facing profile page; publication email preferences are stubbed until Milestone 4.

Next: Milestone 2 (Excerpts — taxonomies, Articles, Bills, Trademarks).
