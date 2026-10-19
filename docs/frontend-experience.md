# User experience refresh

October 15, 2026. The front end now emphasizes current reporting, publication editions and research tools. Brand colors and Inter/Source Serif remain; `src/app/(frontend)/edition.css` supplies the editorial layouts after the shared base stylesheet.

## October 19 header and homepage refinement

Inter remains the navigation font, now 15px at a consistent medium weight. The header is 72px tall, with padded links and centered spacing; narrower screens use the existing expandable navigation rather than squeezing the full menu. Header and hero access actions share an orange treatment with sufficient text contrast. The hero uses a straight live-content panel with no faux browser dots, rotation, dot-pattern backdrop or decorative data bars. News rows now show semantic publication dates, and secondary metadata is larger and darker. Serif headings and the existing page structure remain. Browser checks cover narrow phones, tablets, the desktop breakpoint, wide screens, and signed-in user/staff headers.

## Routes and behavior

- `/`: live product presentation using actual published news, legislation and public dataset metadata; latest reporting, research, reference-library links, upcoming events and company subscription options. Users still go straight to their briefing. External image placeholders have been removed.
- `/dashboard`: latest Executive Summary (or newest available edition), policy updates, news, dataset updates, published Trade Barometer and upcoming events. `currentEditions` fetches one published issue per publication so frequent daily editions cannot crowd out monthly titles. Draft reports remain in staff admin until published.
- `/articles`: wider desktop research layout with filters in a separate column, date groups, publisher names and distinct excerpt summaries for eligible users. Keywords search titles for anonymous users and the existing full-text index for subscribers. Ranked searches paginate up to 500 matches.
- `/articles/:id`: reading column, linked topic filters, related reporting and a clear original-source action. Headline-only migrated excerpts do not produce repeated summaries or repeated body headings.
- `/datasets`: category navigation, Premium-only real record previews and coverage calculated across the entire dataset. The five-record preview is explicitly labeled as a sample; its bars are not historical trends or totals. Anonymous/Base visitors see public catalog metadata only.
- `/datasets/:slug`: chart/table toggle, country/year selectors, record search, measure selector and downloads. The latest available year is initially selected. Charts compare up to 12 individual records, preserving dimensions and units instead of summing percentages or unrelated rows. Upload date and year coverage have separate labels.
- `/publications`: issue library with uploaded artwork or branded title covers, cadence and latest edition. Archives group dated issues by month; issue pages retain existing ad placement and publication headers/footers.
- `/guides`: reference shelf with actual uploaded covers or typographic fallbacks, last update, subscription tier and download details. One-pixel migration thumbnails are treated as placeholders. Base users only receive guides explicitly opted into Base access, including in navigation, search and direct routes.
- `/events` and `/events/:id`: event artwork/channel branding, upcoming and past collections, programme, speakers, venue, sponsors and registration area. Existing ticket checkout and attendee-only replay/livestream rules remain.
- `/search?q=`: title search across news, legislation, dataset metadata and the user's authorized guide/publication library; at least two characters, at most 160. News and legislation retain their deeper section searches.

Navigation gives Publications and Guides separate top-level menus: publications are recurring dated editions and issue archives, while guides are maintained reference material and downloads. They also have separate homepage sections and clearly named catalog headings. Legislation contains the bill library and StateNet iTrac. Menus use buttons with expanded state, outside-click and Escape handling. Navigation collapses below 1,280px to fit the expanded destination list; the mobile toggle announces its state and resets on route changes. `frontendContext` and `currentEditions` use React request-scoped caching; subscription results are never shared between visitors.

The StateNet iTrac page is `/bills/itrac`. It uses the existing legislative Base/Premium/staff access gate and renders an iframe only for eligible visitors. Set `STATENET_ITRAC_URL` to the StateNet-provided HTTPS iframe source, not raw embed HTML. Query parameters are preserved. Missing/invalid configuration shows a bill-library fallback; the destination is never rendered to anonymous, suspended, expired, unverified or no-plan users. The page includes a titled iframe and a new-tab fallback. A synthetic intercepted provider URL is used in browser tests; testing a real portal still requires the supplied URL and confirmation that StateNet permits the beta/launch domains to embed it.

## Data correctness and access

The previous viewer and CSV/Excel exports silently stopped at 10,000 records. The rows API now returns stable 2,000-record pages with `page`, `totalPages` and `totalDocs`; `DatasetGrid` loads every page with cancellation on unmount. Exports also read all pages. The viewer explicitly states that downloads include the complete dataset rather than its current filter selection.

The rows and exports APIs retain their Premium guard before any data queries. `datasetPreview` checks the effective plan before coverage SQL or record reads. Full-dataset coverage uses bound JSON column keys and dataset ID; do not turn it into a public endpoint. All new user content queries use `user` and `overrideAccess: false`; explicitly published filters keep drafts out of user discovery. Existing publication-issue ad rendering and staff draft previews remain supported.

`public/share-card.png` replaces the external social-image placeholder; regenerate it with `node_modules/tsx/dist/cli.mjs scripts/generateShareCard.ts` after brand changes. It uses the existing logo and code-generated typography.

## Verification

313 offline tests pass (3 optional integration tests skipped). Regressions cover numeric missing/zero/negative cells, percentage comparisons, filters, full export pagination in both formats, Premium data access, private previews, one edition per publication, date grouping and placeholder artwork. The request-context tests also ensure `headers()` is resolved before Payload initialization: Railway builds cannot reach the private database while Next prerenders an otherwise static auth page.

Authenticated local browser checks covered anonymous, Base, Premium and no-plan users on desktop and at 390px width. Checks included direct Premium-guide rejection for Base, protected data APIs and exports, complete loading of 21,366 trade records, real CSV/Excel row counts, chart/table switching, filters and empty results, dropdown keyboard/Escape behavior, mobile navigation, publication issues and horizontal overflow. Temporary local accounts/providers were removed after verification; verification emails were disabled, and no imports, purchases or publication sends were performed.

Artwork falls back to branded typography when no usable upload exists; no event photographs, cover dates, page counts or numerical trends were invented. Existing terms/privacy copy is unchanged by this visual refresh.

## Supplied photography

Eight user-supplied photos were added after the initial user refresh. The placement map and regeneration instructions are in [assets/photography/README.md](../assets/photography/README.md). Full-resolution originals were moved from `/photos` to `assets/photography/originals/` and are excluded from Git and deployment uploads. The site serves 24 responsive WebPs from `public/images/editorial/` (640, 1280 and 1920px), totaling about 4.53 MB versus 45.70 MB of originals.

The homepage uses the capitol, port aerial and drying leaves; Guides uses the field aerial; Legislation uses the chamber; Trademarks uses the stamp. The supplied Lansdowne image appears for ATNF 2027 and ATNF entries explicitly naming that venue. The shipping photo is the Trade Barometer cover fallback. Usable CMS event/cover artwork still takes precedence. All photographs were checked at 1440px and 390px, including loaded image sources and overflow; 316 offline tests pass with the photography regressions.

## Beta release

Railway deployment `21144e5b-047d-4cf1-ab2e-03c1214c2ca2` reached `SUCCESS` on October 15, 2026. Live beta checks passed for the homepage, news, data catalog and viewer, events, publications, guides and search; desktop/mobile navigation, anonymous Premium API/export rejection, admin login protection and the exact social artwork asset also passed. Authenticated user-tier and full-export checks were completed locally. No beta test accounts were created.

Two earlier builds failed before rollout because request context was resolved after Payload initialization. The corrected build resolves headers first and successfully completes static page generation; the regression is covered by `frontendContext.test.ts`.
