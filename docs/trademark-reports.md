# Trademark report PDFs

Implemented October 15, 2026. The weekly and monthly trademark publications now receive real PDFs, rather than the previous empty placeholder file.

## Staff workflow

Open `/admin/trademark-reports` (gatekeeper or administrator).

- **Run live USPTO import** imports class-34 Gazette records and drafts the applicable reports. A successful automatic import remains idempotent by Gazette issue date.
- **Generate a report** builds a new draft from records already in the CMS, without downloading the Gazette again. Choose a weekly ending date or a reporting month. Each click intentionally creates a fresh draft; existing issues and PDFs remain unchanged. No matching activity means no draft is created.
- Open the resulting draft issue and its attached PDF for review. Generation does not publish or send it. Publication email delivery remains a separate workflow.
- The fixture importer is still under Development tools and writes illustrative records; use the offline preview script for layout checks instead.

## Reporting periods

Weekly reports include seven UTC calendar days through the selected ending date, inclusive. Imports use the **Gazette issue date**, including a coming Tuesday imported on Friday, rather than the wall-clock import date. Both lower and upper date bounds are enforced.

For marks in the opposition-publication section, the importer now stores the Gazette issue date as `publishedDate`. The feed's `MarkCurrentStatusDate` is a stale status snapshot and can be several weeks earlier (confirmed against the October 13, 2026 feed). Renewal and cancellation dates retain their event dates. To correct previously imported publication dates, manually rerun that specific Gazette issue before regenerating its report; existing archived PDFs are preserved.

Automatic monthly generation runs when the Gazette issue date is within days 1-7. It includes marks **published for opposition**, cancellations, and renewals in the **previous complete calendar month**, with an exclusive first-of-next-month upper bound. Published marks use the same stored publication dates as the weekly reports. Manual monthly generation can select any month. Counts come from the actual matching records, not just the latest import's counts. A mark with multiple types of activity appears in each applicable section and counts as one event in each.

Monthly generation requires a successful official USPTO import for **every Tuesday Gazette issue dated within that month** (four or five). `src/lib/tmog/monthlyCoverage.ts` checks each exact issue date, succeeded status, and official feed URL. A complete import with zero matching class-34 marks still counts. Failed/running imports, fixture runs, and having a few trademark records or weekly PDF drafts do not prove coverage. Duplicate imports of one issue cannot substitute for a missing week.

Missing coverage returns HTTP 409 with `INCOMPLETE_TRADEMARK_MONTH`, the missing ISO issue dates, and a staff-facing message listing the exact `YYYYMMDD` dates to import. Validation happens before PDF rendering, upload, or draft creation. Import those issue dates, then retry monthly generation. During the automatic weekly import, monthly coverage failure is logged and shown in the import result/history; the fully imported week remains succeeded and its weekly draft is preserved. The offline fixture importer only generates weekly drafts and cannot fabricate monthly coverage.

All matching records are fetched in pages of 500; reports are not capped at 500 marks. Records are ordered by title. The CMS holds the latest stored event date per trademark, so this is a report of stored records, not a full historical event ledger. Regenerating an old period after later renewals or corrections can differ from an archived issue. Published historical issues are preserved.

## PDF design and files

`src/lib/tmog/reportPdf.tsx` uses the same renderer and measured pagination engine as the Trade Barometer. Letter-size pages include Nicotine360 branding, reporting period, generation date, source, page counts, mark titles, identifiers, owners, available dates, goods/services, and clickable USPTO TSDR record links. Monthly activity has separate publication, cancellation, and renewal sections. International class is omitted because all tracked marks are class 34.

Mark artwork is read from configured local media storage or the site's own Payload media endpoint when S3 is enabled. Images are normalized to PNG, bounded in resolution, and optional. An unavailable image logs a warning and never removes the textual record. The original record URL is not fetched. Noto Sans regular/bold fonts are bundled with their open font license for consistent accented Latin, Greek, and Cyrillic text across environments.

PDF bytes are uploaded directly to `guide-files`; temporary files are not needed. If draft creation fails after upload, the unattached upload is deleted. Missing publication generator configuration stops generation with an error. No database migration or external API credential is required.

Publication attachments expose `/api/publication-files/file/<filename>` URLs, including existing uploads. The shared upload collection is labeled **PDF files** in the admin; its legacy internal slug and storage keys remain unchanged. An after-read hook identifies publication attachments without recursively populating the file. A Next.js rewrite sends publication downloads through the same Payload access checks and file handler, preserving range requests and original guide-file links. Guide-only attachments retain their guide URLs. This applies to both trademark reports and the Trade Barometer. Regenerate an older PDF to apply the layout change; stored PDF bytes are not rewritten automatically.

## Verification

Run `pnpm test` and `pnpm exec tsc --noEmit`. Regression coverage checks date validation, leap years and year rollover, calendar-month queries, counts, pagination beyond 500 records, draft-only writes, orphan upload cleanup, staff authorization, long descriptions, record preservation, source links, and physical page/header/footer bounds.

Generate offline, illustrative previews with:

```powershell
pnpm exec tsx scripts/previewTrademarkReports.ts
```

Outputs are under gitignored `tmp/trademark-reports/`. These are layout fixtures, not reports for distribution. Render and visually review all pages after changing the layout or upgrading the PDF renderer. Existing historical placeholder PDFs are not rewritten automatically; regenerate their period from the admin page if needed.
