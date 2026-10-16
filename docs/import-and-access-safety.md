# Dataset imports and safety controls

## Dataset replacement

`src/lib/writeDatasetRows.ts` is the shared trusted import writer for CSV uploads and annual trade refreshes. It locks the parent dataset, computes trade aggregates on that same connection, deletes only the requested scope, inserts in batches of 1,000, and updates import metadata in one Postgres transaction. The total row count is computed from all rows in the database. There is no 20,000-row read cap. Another importer for the same dataset waits for the lock; ordinary readers see the old complete version until commit. An insert or metadata failure rolls everything back. Trade refreshes with no source facts preserve the existing dataset.

This writer intentionally bypasses row-level Payload hooks; dataset rows have no custom hooks or versions. Staff authorization remains in the import endpoints. Census fact-file commits and PDF generation remain separate stages: this transaction protects each dataset replacement, not the entire Census-to-PDF workflow.

Run `DATASET_INTEGRATION=1 pnpm exec vitest run src/lib/writeDatasetRows.integration.test.ts` against local Postgres. Tests create session-local temporary tables that shadow the app tables and disappear on disconnect. They check 21,050-row imports, repeat replacement, preservation of other years/datasets, and rollback after later-batch or metadata failure. No real dataset rows are changed. GitHub Actions runs these checks using an isolated Postgres service, plus TypeScript and the offline suite.

## Protected PDFs

File reads now inherit permissions from a **published** parent. Staff can review draft/unlinked files. Base readers can read published Base-accessible guides and publication issues; Premium readers can also read Premium guides. Draft-only and unlinked uploads are denied to readers. All parent pages are checked without a fixed result cap. Publication and legacy guide download URLs use the same handler and access checks.

## Webhooks

- Stripe always requires `STRIPE_WEBHOOK_SECRET` on a hosted site. Missing configuration returns 503; bad signatures return 400 before any order mutation.
- SES/SNS requires `SES_SNS_TOPIC_ARN` and a valid signature on hosted sites, even when `SES_MODE=simulated`. Missing configuration returns 503, other topics 403, and bad signatures 400. Subscription confirmations only follow an HTTPS SNS endpoint for the signed topic's region, matching the signed topic/token, with redirects refused. See [AWS's signed SNS message format](https://docs.aws.amazon.com/sns/latest/dg/SendMessageToHttp.prepare.html).
- The legacy Mailchimp mutation endpoint is disabled (410) while SES is the sender. If explicitly using live Mailchimp, it requires `MAILCHIMP_WEBHOOK_SECRET` in the webhook URL's `secret` query parameter. Do not log/share that URL.
- Unsigned fixtures require `ALLOW_UNSAFE_LOCAL_WEBHOOKS=true`, development/test mode, and loopback request, site, and database URLs. Hosted environments cannot enable this shortcut merely by selecting a simulated sender.

Live publication delivery and signed SNS feedback are now implemented and verified on beta; see [newsletter delivery](./newsletter-delivery.md). Stripe test webhook configuration/checkout verification remains on [the current checklist](./project-status.md). Do not enable unsigned shortcuts as a workaround.

## Demo seed reset

The normal `nic360` working database and all hosted databases are protected from the destructive demo seed. Before importing Payload/config or connecting to a database, the script requires all of:

- A loopback database named `nic360_demo`, `nic360_test`, or `nic360_<name>_demo`/`nic360_<name>_test`.
- `ALLOW_DESTRUCTIVE_LOCAL_SEED=true` and the explicit `--reset-local-demo` argument.
- Non-production mode, local file storage, simulated providers, and no configured SES or Stripe service credentials.

Only for an intentionally disposable, dedicated demo database:

```powershell
$env:DATABASE_URI='postgresql://postgres:postgres@localhost:5432/nic360_demo'
$env:ALLOW_DESTRUCTIVE_LOCAL_SEED='true'
pnpm seed --reset-local-demo
```

Do not point a demo seed at a tunnel to real data. These guards supplement database backups; they do not replace them.
