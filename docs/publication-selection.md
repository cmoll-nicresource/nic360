# Excerpt publication selection

Confirmed October 16, 2026:

| Publication | Excerpts | Geography / product |
| --- | --- | --- |
| US News Clippings | Published news articles only | At least one US location, including descendants. All products, including vapor. |
| Global News Clippings | Published news articles only | At least one location outside the US hierarchy. US plus non-US stories qualify; US-only stories do not. |
| Vapor News Clippings | Published news articles only | Vapor/E-liquid, Vapors/Tanks/Mods, Electronic Cigarettes and E-Liquid product terms, any geography. |
| Daily US Legislative Snapshot / Weekly US Legislative Report | Published bills | US locations, including descendants. |

All publications named Clippings select news articles rather than bills or trademarks. Named US/Global publications enforce their geographic boundaries during building, even if the saved filters are incomplete. Other saved subject/sector filters continue to narrow selection. US News Clippings covers all products. Untagged excerpts do not satisfy US or Global geography requirements.

Global uses a positive match against non-US location IDs, rather than rejecting every story with a US tag. A mixed US/China story can therefore appear in both US and Global. Its Global heading uses the non-US location. Locations added later are included automatically; US state/city descendants remain domestic.

Builds use the saved issue date, not the current date. The default window is 1/7/30 calendar days for daily/weekly/monthly publications, ending on and including the issue date in Eastern time. A weekly October 16 issue covers October 10–16. The source date is used for news, bill date for legislation and published date for trademarks. Later and earlier dates are excluded. Both location lookup and excerpt retrieval paginate through all results.

Build from rules requires a saved draft and writes a draft. Published editions are protected from direct rebuilding. Editors can still adjust the selected draft list manually. Changing rules does not automatically overwrite saved issue contents or historical editions; refresh a draft with **Build from rules** after saving its date.

`scripts/repairPublicationSelectionRules.ts` previews saved-rule corrections; `--apply` updates the publication definitions only. The repair is repeatable and requires a unique United States country location. Seed defaults use the same policy. No schema migration is needed.

Regression tests cover US descendants, mixed locations, untagged content, vapor overlap, article-only Clippings, published status, date boundaries/DST, pagination and draft-only rebuilding. Real Payload/Postgres tests use disposable local records and also run in CI.
