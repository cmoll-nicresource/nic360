# Industry Research and Monthly Research Digest

## Editorial workflow

Use **Industry Research → Create research** in `/admin`. The public library is `/research`; articles use `/research/{id}`. The screens follow the news library and reading layout, with journal/date filters, search, reverse chronological lists and related research.

Fields are Title, Authors (in order, separated by semicolons), Published date, Journal, DOI link and Body. Journal is the additional selector needed to reproduce the supplied digest's grouping. Admins manage the journal catalog under Taxonomy; editors select existing journals. The initial 91 entries come from the supplied **Monthly Digest links.xlsx**. Existing entries are preserved by the setup process.

Common run-in abstract labels (Background, Methods, Results/Findings, Conclusions and journal-specific multiword labels) appear in separate paragraphs. This is applied on read for existing articles and on save for new content, preserving inline formatting and scientific text. Reopen the editor to refresh existing content; regenerate a saved PDF to update its layout. This change is in the CMS and does not require reinstalling N360 Industry Clipper.

Titles, authors, dates and journal names are public. Body, DOI and the hidden original source URL require an effective Base/Premium subscription or staff access. Drafts are staff-only. Gatekeepers do not see editorial workspace navigation; existing inherited staff API permissions are unchanged. Public searches never query private body text.

## Monthly PDF

Open **Industry Research → Generate Monthly Research Digest** (`/admin/research-reports`). Choose a calendar month; the default is the previous month in the staff timezone. The generator includes only published research dated within that month, including the full final day. It stops if there are no matching articles or required article content is incomplete.

The generated issue is a **draft**, titled `Monthly Research Digest - May 2026`, with a current generation/issue date. Review the attached PDF, then publish and deliver through the existing publication workflow. Generation does not send email.

The PDF uses Nicotine360 branding and includes linked contents, journal sections, full body text, authors, publication dates and clickable DOI links. It follows the content structure of the supplied May 2026 digest; it does not recreate its old typography or pagination. The reference PDF was not automatically imported as historical research records.

Regenerating a month updates its existing unsent draft rather than creating another issue. Published or sent issues cannot be overwritten. A database transaction and per-month lock protect concurrent generation. Earlier draft PDF uploads remain available to version history. Draft attachments cannot be downloaded by subscribers; published attachments use the existing protected publication-file URL.

The existing `monthly-research-digest` publication is reconfigured in place. Its ID, subscriber preferences and historical issue content are preserved.

## N360 Industry Clipper

Download the ZIP from the generator page, or use the tracked [`research-ext`](../research-ext/README.md) folder. Extract to a permanent folder, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**. Install this alongside N360 News Clipper. Website deployment does not install or update Chrome extensions.

Connect through the website's staff sign-in and approval screen. The packaged extension connects only to `https://beta.nicotine360.org`, with a fixed Chrome ID `lbmeppjclkfpiiaieenckfnphnlhnbge`. It stores a revocable, 12-hour clipper credential locally, rather than a staff password or JWT. Research and News credentials cannot be substituted for one another. Disconnect in extension options or revoke through the admin's Connected browsers screen.

While viewing a journal article, click the extension, review title, author order, original publication date, DOI, journal and abstract, then save a draft. Missing fields remain blank and are flagged for review. Publishing still requires complete authors, date, journal and body. DOI/source matching returns an existing record instead of adding a duplicate. Formatting is converted to safe plain-text paragraphs for editor review.

Extraction supports scholarly citation metadata, Schema.org JSON-LD and visible abstract sections, including common MDPI, BMC/Springer Nature, JAMA and BMJ patterns. Partial publication dates and modification-only dates are not treated as publication dates. It reads only after a click, does not crawl journals, and does not bypass paywalls. Editors must review the first imports from each publisher: the 91 sites have not each been certified. A live MDPI reference page returned HTTP 429 during verification; no bypass was attempted. BMC's Harm Reduction Journal redirect to Springer Nature was confirmed.

Metadata references: [Google Scholar citation tags](https://scholar.google.com/intl/en/scholar/inclusion.html) and [Schema.org ScholarlyArticle](https://schema.org/ScholarlyArticle).

After changing extension source, rebuild `assets/extensions/n360-industry-clipper.zip` with `scripts/packageResearchExtension.ps1`; preserve the manifest key/registered ID. Keep shared connection-security fixes synchronized with N360 News Clipper.

## Database setup and checks

`node --import tsx migration/prepareIndustryResearch.ts` previews the additive schema transaction and rolls it back. With `--apply`, it applies `migration/industryResearch.sql`, inserts missing journal records and reconfigures the existing Monthly Research Digest. It uses direct PostgreSQL queries without starting Payload, background jobs or email. An unexpected missing/duplicate canonical publication stops configuration rather than choosing another publication. Review the database target before applying; normal deployment does not run this script automatically.

The migration was rehearsed on a disposable PostgreSQL clone, including rollback preview and repeat application. Automated checks cover public/subscriber/staff field access, drafts, taxonomy restrictions, native unpacked Chrome identity, metadata extraction, client credential separation, duplicate DOI imports, extension download authorization, month boundaries, draft exclusion, PDF download gating, regeneration protection, complete long abstracts, working PDF destinations and page footers. Browser checks use synthetic records, isolated PostgreSQL and disabled external delivery. See [testing](./testing.md) for the full suite and limitations.

October 19 beta verification confirmed the 91-journal authenticated catalog, draft import, duplicate detection, anonymous draft rejection and immediate clipper revocation. The temporary draft, versions and credential were removed. The existing publication remains ID 124; no subscription preference or historical issue content was rewritten. Cross-browser testing also exposed an early-input hydration race; the generator's controls now remain disabled until the form is ready, preserving the chosen month.
