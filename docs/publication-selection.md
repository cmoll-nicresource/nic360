# Excerpt publication selection

New issue titles default to `Publication Name - October 9, 2026` for daily/weekly publications, using the saved issue date. Monthly defaults use the previous calendar month and year, e.g. `Publication Name - September 2026` for an October issue. The editor updates suggested titles when the publication/date changes and preserves custom titles. Server-side defaults run before required-field validation. Automated trademark reports use the same format; historical trade reports use their actual reporting month. Existing saved titles are not bulk-renamed.

Confirmed October 16, 2026:

| Publication | Excerpts | Geography / product |
| --- | --- | --- |
| US News Clippings | Published news articles only | At least one US location, including descendants. All products, including vapor. |
| Global News Clippings | Published news articles only | At least one location outside the US hierarchy. US plus non-US stories qualify; US-only stories do not. |
| Vapor News Clippings | Published news articles only | Vapor/E-liquid, Vapors/Tanks/Mods, Electronic Cigarettes and E-Liquid product terms, any geography. |
| Daily US Legislative Snapshot / Weekly US Legislative Report | Published bills | US locations, including descendants. |

All publications named Clippings select news articles rather than bills or trademarks. Named US/Global publications enforce their geographic boundaries during building, even if the saved filters are incomplete. Other saved subject/sector filters continue to narrow selection. US News Clippings covers all products. Untagged excerpts do not satisfy US or Global geography requirements.

Global uses a positive match against non-US location IDs, rather than rejecting every story with a US tag. A mixed US/China story can therefore appear in both US and Global. Its Global heading uses the non-US location. Locations added later are included automatically; US state/city descendants remain domestic.

Builds use the selected issue date, including unsaved form changes, rather than the current date. The default window is 1/7/30 calendar days for daily/weekly/monthly publications, ending on and including the issue date in Eastern time. A weekly October 16 issue covers October 10–16. The source date is used for news, bill date for legislation and published date for trademarks. Later and earlier dates are excluded. Both location lookup and excerpt retrieval paginate through all results.

**Build from rules** appears below Format as soon as **Excerpt list** is selected, including on the creation screen. It reads the current publication/date and fills the current form's sections without saving, publishing or sending. Other unsaved edits remain intact. Review the resulting sections, adjust them if needed, then **Save Draft**. Building replaces the section list; changing rules alone does not alter saved issues or historical editions.

The staff-only `POST /api/publication-issues/build-from-rules` endpoint supports this non-persisting editor action. The older `POST /api/publication-issues/:id/build-from-rules` endpoint remains available for existing saved-draft callers and still refuses direct rebuilding of a published issue. Both use the same selection/grouping pipeline.

The issue creation/edit form hides the entire Email group. All publication email subjects use the issue title; historical subject overrides are ignored. Stored send state, preview text and historical metadata remain available to the sender and preview. Delivery statistics appear as a read-only summary with a status badge and recipient/delivery/open/click/bounce/complaint cards. These are recorded event counts, not unique-reader rates; reload to refresh them. The existing server-side protections continue to preserve authoritative statistics and block edits while an issue is sending. No database migration is required for this layout change.

`scripts/repairPublicationSelectionRules.ts` previews saved-rule corrections; `--apply` updates the publication definitions only. The repair is repeatable and requires a unique United States country location. Seed defaults use the same policy. No schema migration is needed.

Regression tests cover US descendants, mixed locations, untagged content, vapor overlap, article-only Clippings, published status, date boundaries/DST, pagination and draft-only rebuilding. Real Payload/Postgres tests use disposable local records and also run in CI.
