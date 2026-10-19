# Testing and release checks

Updated October 19, 2026. The repeatable checks are in `.github/workflows/checks.yml`.

## What runs on every push and pull request

| Check | Coverage |
|---|---|
| TypeScript and ESLint | Application, scripts and tests; existing lint warnings are not suppressed |
| Offline tests with V8 coverage | Access rules, publication selection/titles, report calculations/rendering, checkout, email/suppression, imports and operational monitoring |
| Disposable PostgreSQL integration | Newsletter acceptance/retry/unsubscribe/bounce state, dataset writes, migration repair, forward-only historical login backfill with stale-snapshot protection and unchanged-account checks, company usage, operational alerts, publication rules and checkout |
| Synthetic trade PostgreSQL integration | Public report dimensions plus invented decimal facts; independent SQL totals and all six chapters; no historical/customer dump required |
| Production build and browser tests | Chromium, Firefox, WebKit and a Chromium phone viewport |
| Account journey | Signup email captured in a loopback SMTP inbox, wrong/expired/limited codes, provider matching, one-time completion proof, password reset, migrated profile/company/preference preservation, old-session invalidation, expired/replaced/replayed links, recoverable request errors, suspended-account restrictions and unmatched-company pending access; see [account onboarding](./account-onboarding.md) |
| Public ticket pricing | Both prices and savings before sign-in, applicable checkout estimates, same-price fallback, virtual-only selection, hidden legacy switches and server-calculated subscription rates |
| Subscription and attendance terminology | All four subscription/registration combinations, event-specific access, and no attendee status inferred from a missing provider |
| Endpoint permissions | Anonymous, none, Base, Premium, suspended, unverified, expired, editor, gatekeeper and admin; protected PDFs, drafts, dataset/export, taxonomy, admin-only migration IDs, staff directory, latest-login ordering with blank dates last across filtered pagination and unlimited reads, subscription changes and privilege escalation |
| Editorial journey/configuration contracts | Full excerpt entry, automatic title, rule build before first save, preserved unsaved edits and explicit draft save, unsent preview, hidden Email fields, read-only delivery cards and preserved send metadata/counters; actual seeded publication settings and repaired legacy Vapor taxonomy |
| Workspace navigation and events | Ordered role-specific menu, guide edit links, most recent/next event links, filtered past archive, event-scoped settings/program edits, draft session creation, directory search and registration, active counts excluding cancelled tickets, event analytics, phone overflow and DST/final-day handling |
| Accessibility | Axe WCAG A/AA scans of home, login, signup, password reset and gatekeeper workspace, across the browser projects |
| Email rendering | Five excerpt editions at 320, 390 and 1,200 pixels; screenshots and rendered HTML retained for review |
| Navigation and legislative portal | Separate Publications/Guides menus at 390, 1,024 and 1,440px; iTrac navigation, synthetic embedded portal, new-tab fallback, accessibility and role-based URL/iframe visibility |
| News clipper | Website staff approval, PKCE/single-use scoped credentials, admin-only Connected browsers screens, continued editor clip/import/disconnect, owner-only browser revocation, full CMS denial, paginated existing location catalog, real PostgreSQL preview/date/location persistence, edited excerpt preservation, draft-only import, tracking URL duplicates and preview field privacy |
| Industry Research | Public title/subscriber body and DOI access across all roles, journal restrictions, separate clipper credentials and duplicate imports, metadata/abstract extraction, authorized extension ZIP download, real unpacked Chrome identity, full-month published-only digest inclusion, PDF draft/publication gating, draft regeneration and published-issue protection; see [research runbook](./industry-research.md) |
| Bounded load | 80 alternating anonymous/Premium reads at concurrency 10, access-boundary checks, a 5,020-row CSV export and a company report over 15,000 views |
| Backup/recovery smoke | Actual backup worker against synthetic PostgreSQL, shared-snapshot fingerprints, archive checksums and an isolated network-disabled restore; synthetic attachment byte/hash checks |

The measured offline baseline is **576 passing tests**, with 52 opt-in integration tests skipped by that command. Those integrations are enabled separately in CI. The browser matrix has **165 active checks** (plus three expected non-Chromium extension-runtime skips). Publication grouping regression tests cover continent → primary subject, subject-only US News Clippings, stale saved settings, missing taxonomy, mixed-country stories, region tags accompanying US-only stories, genuine foreign-region tags, nested linked contents and semantic heading levels. Edition deduplication tests cover repeated IDs, migrated copies with different IDs/timestamps/taxonomy, changed excerpts, different source URLs, incomplete records and eligibility before deduplication; the PostgreSQL fixture includes separate records for an identical story. Email browser checks exercise the nested layout at all three widths. Current offline coverage is 44.93% statements, 43.72% branches, 47.16% functions and 45.98% lines across access/hooks/library/API modules, including untested modules. Conservative floors prevent regressions; this is not a claim of comprehensive coverage.

The standalone `tma-ext/` repository also has ten Chromium extraction/popup/connection tests (`npm test` there). They use synthetic publisher metadata and mocked Chrome APIs, including PKCE/state validation, local credential storage and disconnect retry. Because that repository is excluded from the website repository, those standalone tests run separately; the CMS contract above runs in website CI. A separate disposable unpacked-Chrome smoke check verifies the real extension ID and API availability. Every publisher's markup remains outside those fixture guarantees.

CI retains HTML coverage, browser traces for failures, screenshots and synthetic email review files for seven days. Real recovery data must never be uploaded as an Actions artifact. A phone viewport is not a real iPhone; WebKit is not a guarantee of every Safari version. The bounded load test is a regression check, not a maximum-capacity measurement.

## Run locally

```sh
pnpm test:coverage
node --test ops/backups/health.test.mjs
docker run -d --name nic360-browser-tests -p 127.0.0.1:5444:5432 -e POSTGRES_PASSWORD=local-e2e-only -e POSTGRES_DB=nic360_e2e_test postgres:18
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e:seed
pnpm test:e2e:build
pnpm test:e2e
```

Use a new, disposable database named **exactly `nic360_e2e_test`**, accessible only on loopback. `TEST_DATABASE_URI` can override the default loopback port. The harness clears external provider credentials, enables email safe mode, captures mail without relaying, and disables automatic jobs. Its isolation gate refuses other database names/hosts or enabled provider credentials. `seed --reset` drops only this guarded test database's public schema; do not use it against the working database. Remove the explicitly named test container and its anonymous volume after use. Test PDFs have unique `e2e-UUID.pdf` names; never delete the entire working upload directory.

## Independent and human checks

The separate [backup/recovery workflow](../.github/workflows/recovery.yml) is enabled: it checks completed snapshot freshness every six hours and provides a weekly/manual restore. A dedicated read-only daily logical-export service and master-only AWS OIDC role are provisioned; see [backup recovery](./backup-recovery.md). The synthetic CI rehearsal also works without cloud credentials. AWS SNS email delivery requires the recipient's subscription confirmation. Repeated identical failure emails are limited to once daily; a changed failure alerts immediately.

Actual Outlook/Gmail and mobile mail-client rendering still require human review. Open the generated `email-review/*.html` and screenshots from the CI artifact, then inspect a controlled delivery to the approved staff inbox. Check the logo, excerpt text, linked contents, legislative fields, dark mode, image blocking, link targets, footer and unsubscribe. Browser screenshots do not certify Outlook's Word renderer or Gmail's CSS rewriting. No user audience send or real Stripe charge is part of this suite.

SES accepted five `[TEST layout review]` synthetic samples to `cmoll@nicotineresource.org` during this work. They contain a staff-review notice and disabled preview unsubscribe links; acceptance is not proof of inbox placement or client rendering. `ops/email-review.mjs` defaults to a dry run and requires `--send-to-approved-staff` to repeat this fixed-recipient send. Do not use the samples as real issues.

External providers also need periodic controlled checks: hosted Stripe test checkout with a signed webhook, SES simulator feedback and unsubscribe, Census/CBP/USPTO source availability, and restoration after significant schema/storage changes. Unit mocks and synthetic PostgreSQL cannot prove those services are reachable. Record date, environment, outcome and cleanup in the relevant runbook.

Before launch, staff should still perform a beta acceptance pass using their actual roles and review publication content. Automated checks do not settle editorial accuracy, consent, audience selection, live-payment activation or cutover decisions.
