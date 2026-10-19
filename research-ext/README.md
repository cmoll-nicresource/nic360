# N360 Industry Clipper

Install this extension separately from the existing N360 News Clipper.

1. Extract the downloaded ZIP into a permanent folder (or use the project's `research-ext` folder).
2. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select that folder.
3. Open N360 Industry Clipper options and choose **Connect to Nicotine360**. Complete the site's staff sign-in/approval. No endpoint or password is stored in the extension.
4. Browse a journal article, click the extension, review title, author order, publication date, DOI, journal and abstract, then save a research draft.
5. Review the draft in the CMS and publish it when complete. Journal records are managed by admins; editors select existing journals.

The catalog starts with the 91 journals in the supplied Monthly Digest links workbook. Common scholarly citation tags, Schema.org JSON-LD and visible abstract sections are supported, including MDPI, BMC/Springer Nature, JAMA and BMJ markup patterns. Publisher pages can vary; missing metadata is flagged for review rather than invented. Only a complete day/month/year date is imported. Partial dates, missing abstracts and missing DOIs remain blank. The extension reads the current page only after a click; it does not crawl journals or bypass paywalls.

Connections are local, short lived and revocable. Research credentials are bound to the N360 Industry Clipper and are rejected by N360 News Clipper endpoints. The packaged site is beta.nicotine360.org. The manifest public key fixes the extension ID; preserve it in updates. Keep `shared.js` security fixes synchronized with the N360 News Clipper's connection flow; do not introduce staff JWT storage or user-configured endpoints.

The CMS generator is at `/admin/research-reports`. Choose a calendar month to create a draft PDF grouped by journal. Publish research first. Regeneration updates only this month's unsent draft; published/sent issues are protected.
