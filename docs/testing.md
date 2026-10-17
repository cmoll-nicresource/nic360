# Testing and release checks

Updated October 16, 2026. The repeatable checks are in `.github/workflows/checks.yml`.

## What runs on every push and pull request

| Check | Coverage |
|---|---|
| TypeScript and ESLint | Application, scripts and tests; existing lint warnings are not suppressed |
| Offline tests with V8 coverage | Access rules, publication selection/titles, report calculations/rendering, checkout, email/suppression, imports and operational monitoring |
| Disposable PostgreSQL integration | Newsletter acceptance/retry/unsubscribe/bounce state, dataset writes, migration repair, company usage, operational alerts, publication rules and checkout |
| Synthetic trade PostgreSQL integration | Public report dimensions plus invented decimal facts; independent SQL totals and all six chapters; no historical/customer dump required |
| Production build and browser tests | Chromium, Firefox, WebKit and a Chromium phone viewport |
| Account journey | Signup email captured in a loopback SMTP inbox, wrong/expired/limited codes, provider matching, one-time completion proof, password reset, token replay and old-password rejection |
| Endpoint permissions | Anonymous, none, Base, Premium, suspended, unverified, expired, editor, gatekeeper and admin; protected PDFs, drafts, dataset/export, taxonomy, staff directory, membership changes and privilege escalation |
| Editorial journey/configuration contracts | Full excerpt entry, automatic title, saved draft, rule build, unsent preview; actual seeded publication settings and repaired legacy Vapor taxonomy |
| Accessibility | Axe WCAG A/AA scans of home, login, signup, password reset and gatekeeper workspace, across the browser projects |
| Email rendering | Five excerpt editions at 320, 390 and 1,200 pixels; screenshots and rendered HTML retained for review |
| Bounded load | 80 alternating anonymous/Premium reads at concurrency 10, access-boundary checks, a 5,020-row CSV export and a company report over 15,000 views |
| Backup/recovery smoke | Actual backup worker against synthetic PostgreSQL, shared-snapshot fingerprints, archive checksums and an isolated network-disabled restore; synthetic attachment byte/hash checks |

The measured offline baseline is **455 passing tests**, with 48 opt-in integration tests skipped by that command. Those integrations are enabled separately in CI. The browser matrix has **79 passing checks**. Initial offline coverage is 43.18% statements, 41.34% branches, 45.41% functions and 44.14% lines across access/hooks/library/API modules, including untested modules. Conservative floors prevent regressions; this is not a claim of comprehensive coverage.

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

The separate [backup/recovery workflow](../.github/workflows/recovery.yml) checks completed snapshot freshness every six hours and provides a weekly/manual restore. AWS OIDC, the daily logical-export service and alert delivery must be provisioned before its operational activation; see [backup recovery](./backup-recovery.md). The synthetic CI rehearsal already works without cloud credentials.

Actual Outlook/Gmail and mobile mail-client rendering still require human review. Open the generated `email-review/*.html` and screenshots from the CI artifact, then inspect a controlled delivery to the approved staff inbox. Check the logo, excerpt text, linked contents, legislative fields, dark mode, image blocking, link targets, footer and unsubscribe. Browser screenshots do not certify Outlook's Word renderer or Gmail's CSS rewriting. No reader audience send or real Stripe charge is part of this suite.

External providers also need periodic controlled checks: hosted Stripe test checkout with a signed webhook, SES simulator feedback and unsubscribe, Census/CBP/USPTO source availability, and restoration after significant schema/storage changes. Unit mocks and synthetic PostgreSQL cannot prove those services are reachable. Record date, environment, outcome and cleanup in the relevant runbook.

Before launch, staff should still perform a beta acceptance pass using their actual roles and review publication content. Automated checks do not settle editorial accuracy, consent, audience selection, live-payment activation or cutover decisions.
