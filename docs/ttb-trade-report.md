# US Tobacco Trade Barometer: operational notes

Field-level detail lives in `docs/entity-map.md`. This is the operational handoff for setup, verification, and known limits.

## What it is

Any editor uploads the monthly Census files (`Imp_MMYYYY.xls`, `Exp_MMYYYY.xls`) at `/admin/trade-reports`. The app loads trade facts, refreshes the US Imports/US Exports datasets, and drafts a PDF Publication Issue for review. Each file commits separately; a later dataset or rendering failure does not undo an already committed import. Generated issues are drafts and are not sent automatically.

Re-uploading the same files is supported: preview shows the existing month, and confirmation replaces that month's facts rather than rejecting a duplicate file hash. This refreshes the affected datasets and creates another draft PDF issue; earlier draft issues/files are retained. For a repeat-upload smoke test, verify the replacement counts in the run log and review the newly created draft's logo, totals, and page transitions. Do not send the draft as part of the test.

The standalone `ttb-trade/` prototype is gitignored. Its historical dump and sample workbooks are local operational inputs, not deployable repository assets. Preserve a secure copy before handing the project to another machine.

## Complete PDFs without editorial placeholders

As of October 15, 2026, successful PDF generation requires complete US-trade figures, TRQ figures, and current/prior-year import/export facts for the report month. Source failures are logged and stop the run before PDF upload or draft issue creation; they no longer generate a highlighted placeholder PDF. The previously committed monthly imports remain loaded if this later step fails. Retry or supply valid manual source inputs, then generate again. Reports remain drafts for review/send; this change does not send automatically or replace old PDFs.

The tobacco lead-in is removed entirely. All six parts use the generation date in US Eastern as their release date; legacy `released` overrides are ignored. Optional US-trade commentary may be omitted. Parts 4 and 5 now contain finished summaries of the actual rate-provision-18 duty-free entries with numeric validation and date-valid report mappings. They describe the recorded category without inferring GSP/CBI eligibility from a country name; Census defines the rate category at https://www.census.gov/foreign-trade/reference/codes/rp.html. The cover's editing instructions are removed.

`report/readiness.ts` validates required source inputs, ranges, quota rows, source month and balance reconciliation. `buildReport` and the PDF renderer reject unresolved `[[...]]` markers, invalid numeric text and unresolved report data notes, including table cells. Operational import warnings and source snapshots stay in the run log. A fresh August 2026 PDF was audited across all 120 pages: no editorial markers, yellow fills, invalid-number text or editing instructions; all six generation-date release lines and chapter destinations are present. Cover, Part 1 and both duty-free summaries were rendered and reviewed. All 285 offline tests and three read-only database integration tests passed.

Beta deployment `91d8d8ab-f28e-4697-a777-396382e32124` reached SUCCESS on October 15, 2026. A read-only check from the deployed app fetched both live sources and built all six chapters from beta's August 2026 facts, with six release lines dated October 15 and zero unresolved report notes. It created no PDF asset or issue and sent no email. Temporary SSH access was revoked and removed after verification. Regenerate the existing monthly draft to get the updated PDF.

## Automatic US trade introduction and linked contents

The cover's six contents entries are internal PDF links to the measured chapter destinations. These work even when earlier chapters change page count; the PDF link regression checks actual GoTo actions and page destinations. A full August 2026 preview with the automated introduction has 120 pages; all six destinations and the cover/Part 1 layout were checked.

When no manual `inputs.usTrade` is supplied, the upload job and local preview fetch FRED's **BOPTEXP**, **BOPTIMP**, and **BOPGSTB** CSVs directly in TypeScript. No Python process or API key is required. These Census/BEA series are monthly, seasonally adjusted goods and services on a balance of payments basis, in millions of dollars; the app converts them to billions. Sources: https://fred.stlouisfed.org/series/BOPTEXP, https://fred.stlouisfed.org/series/BOPTIMP, https://fred.stlouisfed.org/series/BOPGSTB. The supplied Python prototype used quarterly annual-rate EXPGS/IMPGS alongside monthly BOPGSTB and treated all values as billions; those series/units must not be mixed.

The report month is requested explicitly; a newer or older observation is never substituted. All months needed for current/prior YTD and the preceding three-month average must exist in all three series, and exports minus imports must reconcile with the balance within rounding tolerance. January comparisons span the year boundary. Prose handles increases, declines, zero baselines, unchanged values, and surplus/deficit transitions independently for each comparison. The prior-three-month average excludes the report month and is not a calendar-quarter average.

Automatically sourced Part 1 prose and the US summary table are labeled goods and services / BOP / seasonally adjusted, with source and retrieval date. The import-run notes preserve the figures and source metadata as a JSON snapshot for auditing. Each generation fetches current revisions with a 15-second per-request timeout; it does not reproduce an earlier release vintage. A source error is retained in the run log and stops PDF generation until complete figures are available or supplied manually. Legacy manual `usTrade` inputs without source metadata retain the existing merchandise basis and bypass FRED. `buildReport` itself stays network-free; enrichment is performed before acquiring its database connection.

Verification: 257 offline tests and three read-only local database integration tests pass, including monthly unit conversion, complete-period checks, January boundaries, malformed data, source failures/manual override, reconciliation, prose directions, BOP table labels, and internal PDF destinations.

Deployed to beta in Railway release `db65a641-52fd-4fa8-8178-7d2d36de164e` (SUCCESS, October 15 UTC / October 14 Eastern, 2026). Private SSH checks from the deployed app confirmed FRED returns August 2026 exports 315,182, imports 420,754, and balance -105,572, all in millions. The temporary SSH key was revoked and its private files removed. Login, logo, and staff route HTTP checks passed. The user confirmed the preceding report-fix deployment's upload flow worked; a newly generated staff draft should now be reviewed for these additional features. No existing uploaded PDF was changed, and no issue was sent.

## Automatic weekly tobacco TRQ

Missing `inputs.trq` is now enriched independently of US-trade inputs. `src/lib/ttb/trq.ts` looks for the latest available CBP Commodity Status Report in the preceding 14 calendar days, newest first, using the current US Eastern date. It checks every date rather than relying on Monday or a hard-coded holiday calendar. For example, on October 15 it finds the October 13 Tuesday release after October 14 and 15 return 404. The month directory and filename are derived from each candidate date, including year/month rollover. Manual `trq` input still takes precedence.

Requests run in batches of three with five-second request timeouts and a 25-second search budget. Only 404/410 mean a missing release; blocked requests, server errors, timeouts, invalid PDFs, or changed table layouts stop PDF generation with a visible run error rather than silently switching to older data. A search with no release in 14 days also stops for review. Downloads are limited to 5 MB and parsing to 40 pages. PDF.js 5.4.624 is pinned for the existing Node 20 runtime and kept external to Next's server bundle so its installed worker remains available.

The parser uses the PDF header's column coordinates and requires column 1 to start with `24` and column 2 to equal `Tobacco`. FTA tobacco rows beginning `99` are excluded. It reads **Maximum Quantity** as quota and **Allocated Quantity** as usage, validates `KG`, shared quota ID/period/effective dates, the PDF release date, unique countries/regions, and the printed fill percentages. A dash in allocated quantity means zero; a dash in quota is accepted only for the explicit `EXCL` countries Canada, Israel and Mexico, which are retained in provenance but omitted from quota totals. EUROC and OTHR are displayed as European Union (EUROC) and Others. The present source layout requires all 14 expected country/region rows (11 quota rows plus three exclusions); changes require parser review, not silently incomplete output. Imported fractional kilograms are preserved in calculations and provenance; the existing report table rounds quantities for display.

The TRQ section uses the latest weekly status **at generation time**, even if the tobacco trade month is older, and explicitly shows the release date and quota period. It preserves CBP's effective dates verbatim and does not assume a calendar-year quota. Import-run notes save the parsed figures, exclusions, quota ID/period, retrieval time, source URL, and PDF SHA-256. No database migration is required. The report's PDF remains the output snapshot; subsequent CBP updates only affect newly generated reports.

Regression fixtures include both supplied public PDFs (October 5 and October 13, 2026), plus a reduced coordinate fixture for deliberate corruption tests; source URLs and hashes are in `src/lib/ttb/fixtures/README.md`. All 275 offline tests and three read-only local database integration tests passed. Both original PDFs parse successfully; the live lookup returned October 13. In that release, included quota is 150,700,000 kg and allocated usage totals 5,434,602.30 kg (displayed as 5,434,602 kg). The full 120-page preview's TRQ pages 3–4 were rendered and reviewed, including repeated headers, totals and source.

Deployed October 15, 2026: Railway release `1bff48bf-db9c-49d9-9cbb-3bf1e2e9b76a` reached SUCCESS. The exact `fetchLatestTrq` app function was run read-only from the deployed server over private SSH, using Node 20.20.2. It selected October 13 and returned all 11 quota rows and the same totals/hash as the local fixtures. Temporary SSH access was revoked and its files removed. No trade facts were re-imported or draft issue created by this verification; the next staff report generation exercises the integrated upload flow.

## PDF bug: cause and repair

The prototype's `db.ts` configured pg to return BIGINT/NUMERIC as JavaScript numbers. The app port reused Payload's pool without those parsers. Postgres `SUM(bigint)` returns NUMERIC strings by default; `+=` concatenated them into country and line totals. The enormous digit strings then overflowed PDF columns and produced `NaN` percentages. Commit `a990b5a` changed widths and pagination, but a freshly generated PDF still reproduced the problem before numeric conversion was fixed.

`src/lib/ttb/numeric.ts` now converts and checks trade measures at the query boundary, without changing Payload's global parsers. Null sums become zero; fractional quantities remain fractional; malformed, non-finite, and out-of-range values stop generation. Country totals, chart series, annual dataset values, and source-workbook measures use the same checks. Source keys and merged source records are also range-checked. PDF tables reject invalid widths/font sizes and mismatched cell counts. Explicit point widths remain in place.

**Pagination repair:** estimated row chunks were a separate defect. They could reprint headers after Slovenia in the middle of a page, then leave the next table's continuation page without headers. The renderer now opts into the installed `@react-pdf/renderer` 4.9 pagination engine, which measures real content and scopes `fixed` nodes to their immediate parent. Each table contains a fixed, non-splitting title/header group; it repeats at physical page boundaries and ends when that table ends. Body rows remain non-splitting, and adjacent tables can still share pages. There are no estimated chunks or guessed page breaks.

**Branding:** `public/logo.png` is the existing Nicotine360 logo, byte-identical to the supplied `Nicotine 360@4x.png`. The PDF reuses that tracked asset on the cover and every content-page header, uses the brand blue, and displays page/total-page counts. Running headers and footers are instantiated afresh using `Page.layout`, outside the table flow, so their positions do not drift on continuation pages. No workstation-specific asset path or remote image URL is required.

August 2026 local reference: combined flue-cured tobacco exports have YTD quantity **39,757,467 kg**, compared with **51,298,041 kg** in August 2025. The earlier port produced a 223-character string for the current-year total. The opt-in integration test compares the repaired result with an independent SQL aggregate rather than assuming those reference figures never change.

Old PDFs already uploaded to GuideFiles remain incorrect; regenerate and review their draft issues before publication. Fixing the renderer does not replace existing files.

## Verification commands

Run from the repository root:

```powershell
pnpm test                           # offline regressions, including actual PDF layout
pnpm test:trade-report              # local Postgres, read-only integration tests
pnpm trade:check                    # read-only prerequisite check for DATABASE_URI
pnpm trade:render 2026 8            # read-only local snapshot -> tmp/trade-barometer-2026-08.pdf
```

The integration tests and preview renderer require a local DATABASE_URI and do not initialize Payload, push schemas, import files, upload reports, or send email. The preview fetches both external sources automatically, uses the generation date, and enforces the same completeness checks as staff generation. Optional JSON supplies source overrides or US-trade commentary.

Regression coverage includes pg numeric strings and numbers, null sums, fractional quantities, prior-year comparisons, missing months, oversized and non-finite values, country totals, dataset values, 16-column PDF cell geometry, all 70 fixture rows across page breaks, and rejection of malformed tables. The adjacent-category regression checks two-row headers and table titles on every continuation page, no mid-table duplicate headers, no stranded or wrong-category headers, preservation of all body rows, shared pages, and logo presence/position. A mixed portrait/landscape regression checks that the logo, running header, and footer stay within every physical page. The local integration suite checks real SQL aggregates, all six chapters, and the restore guard. The geometry tests use renderer layout diagnostics and the opt-in pagination API; review them when upgrading `@react-pdf/renderer`.

After changes, open a newly generated PDF and inspect Part 1 summary tables plus both export and import country tables, especially totals, YTD columns, percentage changes, long labels, and category transitions across physical page boundaries. Automated geometry checks supplement visual review.

**Visual verification completed October 14, 2026:** the initial numeric-only repair produced 126 pages and passed targeted checks for overlapping digits, but retained the pagination defect above. The subsequent branded/pagination repair produces 119 pages. Rendered cover, summary, and cigarette-paper transition pages were reviewed, including consumption imports on pages 108–109 and general imports on pages 114–115. The uncut table has no extra header after Slovenia, and the cut table resumes on the next physical page with its title and both column-header rows. This is targeted layout verification, not an editorial review of every page. The current preview is `tmp/trade-barometer-2026-08-branded.pdf`.

## First-time Railway beta setup

The Railway beta site (its environment is named `production` in Railway) needs the `ref`, `trade`, and `report` schemas, historical facts, report mappings, exactly one publication with `generator: monthly-trade-barometer`, and the `us-imports` / `us-exports` datasets with the required text/country/year/number columns.

**Do not run `ttb-trade/sql/schema.sql` against an existing database.** It contains `DROP SCHEMA ... CASCADE` for all three trade schemas. It leaves Payload tables alone but destroys trade history and mappings. The previous handoff incorrectly described it as additive.

The local `ttb-trade/db/ttb.dump` includes schema definitions as well as data. Do not pre-create tables and then restore the full dump over them. For a first-time restore:

1. Identify the exact project/environment/Postgres service and take a verified backup. Check disk capacity before restoring: the compressed dump is about 21 MB, but the trade relations expand to roughly 250 MB plus WAL/temporary overhead. The beta volume needs more space than its original 500 MB capacity. Keep staff trade uploads idle during setup.
2. Inspect `pg_restore --list ttb-trade/db/ttb.dump`; confirm the expected three schemas and review the source history. Keep connection credentials out of logs and version control.
3. Prefer a private SSH connection or loopback-only SSH tunnel to the database. A temporary public TCP proxy exposes Postgres and can redeploy the service; do not open one without explicit authorization. Keep target credentials in process memory and leave the local `.env` unchanged.
4. Run the guard below. If **any** trade schema exists, stop and inspect it; this is no longer a first-time restore. Do not delete it to make the guard pass.
5. Restore the verified archive in a single transaction, without `--clean`. It must contain only the three trade schemas. Do not add `--schema` filters: they omit the archive's schema-creation entries and fail against an empty target. Errors roll back the restore.
6. Apply `migration/ttb/payload-schema.sql` (additive trade log tables, document-lock relationship, and publication generator enum value). After that transaction commits, apply `migration/ttb/publication.sql` to create the single monthly PDF Publication. These SQL files were tested in an isolated local scratch database, including a second run for idempotency and log/note/issue/lock relationships. Alternatively create the Publication through Payload's admin. Run `pnpm trade:check` against the target; it checks both trade and Payload prerequisites. Verify month coverage and report mappings, not only table existence.
7. Deploy the reviewed code, test the staff preview/confirm flow with real monthly files, review the new draft PDF, and close the tunnel and remove any temporary SSH key in a finally/cleanup step.

Commands from the repository root, once the target and backup have been verified:

```powershell
psql --dbname "$env:DATABASE_URI" --set ON_ERROR_STOP=1 --file migration/ttb/preflight.sql
if ($LASTEXITCODE -ne 0) { throw 'Preflight failed; do not restore.' }
pg_restore --dbname "$env:DATABASE_URI" --no-owner --no-privileges --exit-on-error --single-transaction ttb-trade/db/ttb.dump
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; inspect the error before proceeding.' }
```

These commands are an operator plan, not evidence that the beta database has been initialized. The read-only preflight refuses existing schemas; it does not reserve them against concurrent changes. Keep setup exclusive until the restore completes.

## Environment status

- Local: historical data and report mappings are present; one matching publication and both datasets exist. Read-only checks passed on October 14, 2026.
- Railway beta database setup completed October 14, 2026: project `illustrious-youthfulness`, app `nic360`, database `Postgres`, Railway environment named `production`, PostgreSQL 18.6. After the user resized its volume to 5 GB, the verified archive was restored over private SSH into the previously absent `ref`/`trade`/`report` namespaces in one transaction. The additive Payload SQL and publication seed both committed. Existing public content was not replaced; the two existing datasets were retained and their text/country/year/number columns verified. Exactly one monthly Trade Barometer publication exists. The temporary SSH key was revoked and its private files removed; no public database proxy was opened.
- Live verification: **424,991 import facts**, **219,817 export facts**, 296 HTS codes, 244 countries, 94 report lines, 701 mappings, and all restored constraints validated. History spans 1999–August 2026. Source coverage has export gaps in January–September 1999 and January 2001; this restore preserves those source gaps. Both flows include all eight months of 2026 and all twelve months of 2025. The combined flue-cured export check returned 39,757,467 kg YTD August 2026 and 51,298,041 kg for August 2025, matching the local reference. Database size after setup was 401 MB, with about 3.7 GB of filesystem space free.
- Verified pre-restore backup: gitignored `migration/data/beta-before-trade-2026-10-14-1792031066303.dump`, 18,217,789 bytes, SHA-256 `f0b2ef159d6054decba7aa8d65cb24416490a97d719e000832d1af2381d5e02e`. The full archive was decoded successfully using PostgreSQL 18 tools before mutation. Source archive SHA-256: `1258e84aade15022e3e0af7b4fd240d5d1ef0f7cc9893485882a7edcd29fbbae`.
- Beta code deployment completed October 14, 2026 (02:51 UTC October 15): Railway deployment `edf2ff2b-cb1e-4481-aa79-666a0ae6e39b` reached SUCCESS. It includes the numeric, pagination, logo, and regression-test changes uploaded from the local working tree. All 240 offline tests and TypeScript checking passed before deployment. Login, logo, and staff trade-report URLs returned HTTP 200; deployed logo bytes match the local asset. A signed-in staff preview/confirm repeat upload and review of the newly generated draft remain to be performed. That initial CLI deployment preceded the subsequent GitHub commits; current report work is committed and pushed. The user has since reported successful beta report generation.

## Known limits

- Rendering a full report takes tens of seconds; the web request runs synchronously.
- Dataset refreshes now use a locked transaction and bulk inserts with no 20,000-row cap. Rows and import metadata commit together; failed replacements roll back. See [import-and-access-safety.md](./import-and-access-safety.md). Census fact-file commits and PDF generation remain separate stages.
- Preview uploads are held in one process's memory. Multiple app instances or a restart between preview and confirm can lose the upload.
- Missing required trade figures stop generation; retry the source or supply complete manual inputs. Trademark PDFs use their separate implementation.
