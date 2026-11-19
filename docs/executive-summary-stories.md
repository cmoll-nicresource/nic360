# Executive Summary stories (Daily Executive Summary)

Status: part 1 (daily issue) deployed 2026-11-18. Part 2 (weekly organizer and PDF) built and checked locally 2026-11-18; not yet deployed.

## Why

Daily Executive Summary (DES) stories are Mike's own write-ups, also posted on Tobacco Reporter (tobaccoreporter.com, which we own). They are not clippings, and they should not appear as browsable news on Nicotine360. Before this, the DES was written and sent from Mailchimp and only a PDF reached the site.

Now an editor builds the DES in Nicotine360 from Tobacco Reporter posts. Each story is **copied** into a `summary-stories` record when it is added, so the archived issue keeps its text even if the post changes. Stories have no pages of their own; subscribers see them only inside an issue, which checks the plan as before.

Going forward, everything in the DES is posted on Tobacco Reporter first.

## Editor workflow

1. Set the Daily Executive Summary publication's **Format** to *Tobacco Reporter stories* (once). Every new issue then takes it; the issue form shows the format but does not ask for it.
2. Create an issue. Under **Stories**, click **+ Add from Tobacco Reporter**: the newest posts are listed; search, or paste a Tobacco Reporter link.
3. For each story, change the headline if needed and choose its **weekly heading**. Both save to the story immediately. The heading is only for the weekly Executive Summary; it is not shown in the daily email.
4. Drag (or use ↑ ↓) to set the running order. The list marks the ad slots: before story 1, 3, 5…, the same rule as other publications. Save the issue.
5. If a post is edited on Tobacco Reporter, click **Refresh** on that story. Refresh re-copies the text, sources and image; it keeps the weekly heading and any headline the editor changed. Issues already sent keep the email HTML they were sent with.
6. Preview, send a test, publish and send as usual.

The headings list (Publishing > Executive Summary headings) is editable and drag-to-reorder. It was seeded with the 13 headings used in the 6 November 2026 weekly edition.

## Weekly Executive Summary (part 2)

The WES (sent Fridays instead of a DES) is a PDF of the week's DES stories plus anything that would have been in a Friday DES, organized under the weekly headings, with one advertiser after the contents.

1. Set the Weekly Executive Summary publication's **Format** to *Tobacco Reporter stories (weekly PDF)* (once).
2. Create the Friday issue. Under **Stories**, click **Add this week's DES stories**: it adds the stories of every *published* Daily Executive Summary dated in the seven days ending on the issue date (Saturday–Friday), oldest issue first, each story once. Unpublished daily issues are skipped and counted in the message. Stories already in the list are kept.
3. Add Friday's stories with **+ Add from Tobacco Reporter**.
4. The list is shown in PDF order: stories without a heading first (highlighted), then each weekly heading in the order of the headings list. Change a story's heading with its dropdown, or drag it onto another story to move it there (it takes that story's heading); ↑ ↓ reorder within a heading. Heading changes save to the story at once; save the draft to keep the list.
5. Save the draft, then click **Generate PDF**. It is built from the saved draft and will not run while there are unsaved changes, while any story has no heading, or once the issue has been sent. The PDF is stored as a protected PDF file and attached to a new draft of the issue; if the summary is empty it is filled with a one-line count. Generating again makes a fresh PDF (older files are kept for earlier versions).
6. Preview, test, publish and send as usual. The email is the summary, the ad and a download button, like other PDF reports.

The PDF (`src/lib/summaryStories/digestPdf.tsx`): title and date, linked **Contents** with page numbers (headings and story headlines), the publication's rank-1 active ad after the contents (linked through the normal ad click tracker), then each heading as a banner followed by its stories: headline, text (paragraphs, bold/italic, links, lists), "Source:" lines, and links to the Tobacco Reporter post and back to the contents. Running header, footer and "Page n of N" on every page. Page numbers come from rendering once, reading where each destination landed with pdf.js, and rendering again; the result is checked.

The ad image is fetched through the site (`SITE_URL`) and converted to PNG; if it cannot be loaded the PDF is generated without it and the editor is told. Under `next dev`, Payload's schema push loads drizzle-kit, which adds an enumerable `Array.prototype.random` that pdf.js rejects; the renderer makes such methods non-enumerable before using pdf.js.

## Tobacco Reporter side

Nicotine360 reads the public WordPress REST API (`/wp-json/wp/v2/posts`), not RSS: the feed only holds the newest 10 posts and has no images. No credentials are used. `TOBACCO_REPORTER_URL` overrides the site address.

Sources are not part of the post text. They come from a private **Nicotine360 sources** box on each post, registered as the post meta field `n360_sources` with `show_in_rest`, one source per line:

```
EU Council | https://www.consilium.europa.eu/...
The Cyprus Mail | https://cyprus-mail.com/...
Antara News Agency
```

A bare link uses its host as the name; a name with no link is kept as plain text. The suggested WordPress plugin (sent 2026-11-18) adds the box, exposes it in the REST API and the RSS feed, and does not display it on article pages. Until it is installed, stories arrive with no sources, and editors can add them on the story record (a refresh then replaces them with Tobacco Reporter's).

## What is copied

- Headline (entities decoded), publish and last-edited times, author when WordPress exposes it.
- Body HTML, sanitized to paragraphs, line breaks, emphasis, lists, block quotes, h2–h4 and http(s)/mailto links. Classes, styles, scripts, iframes/embeds, figures and inline images are removed, as are empty paragraphs and the feed's "first appeared on Tobacco Reporter" line. Stored HTML is sanitized again whenever it is rendered.
- The featured image, downloaded once (8 MB cap, one retry) into Media. If the download fails the story shows "Image not copied; Refresh to retry". Removing the image from the story sends it without one.

Each story ends with its sources ("Source: …") and a link back to the Tobacco Reporter post.

## Code

| Piece | Where |
|---|---|
| Collections | `src/collections/SummaryStories.ts`, `src/collections/SummaryHeadings.ts`; `stories` and the `story-list` format on `PublicationIssues` / `Publications` |
| Pure helpers (tested) | `src/lib/summaryStories/tobaccoReporter.ts`: post copy, sanitizing, sources, pasted links, headline refresh |
| WordPress client | `src/lib/summaryStories/tobaccoReporterClient.ts` |
| Import/refresh | `src/lib/summaryStories/importStory.ts`; routes `GET /api/tobacco-reporter/posts`, `POST /api/summary-stories/import`, `POST /api/summary-stories/:id/refresh` (editor+) |
| Rendering | `renderStoryListBody` in `src/lib/issueEmail.ts` (email, preview and web edition); `issueAdItemCount` in `src/lib/publicationAds.ts` |
| Admin UI | `src/components/admin/summaryStories/StoryListField.tsx` (issue field and picker), `StoryBodyPreview.tsx` (story page) |
| Weekly | `src/lib/summaryStories/digest.ts` (week range, grouping, HTML to PDF blocks, readiness; tested), `digestPdf.tsx` (tested with pdf.js), `generateDigest.ts`; routes `GET /api/publication-issues/week-stories`, `POST /api/publication-issues/:id/generate-digest`; admin `StoryDigestField.tsx` (chosen by `StoriesField.tsx` from the format), shared pieces in `storyEditor.tsx` |
| Schema | `migration/executiveSummaryStories.sql` via `migration/prepareExecutiveSummaryStories.ts`, then `migration/weeklyExecutiveSummary.sql` via `migration/prepareWeeklyExecutiveSummary.ts` (each: preview; `--apply`) |

## Verification (2026-11-18)

- `src/lib/summaryStories/tobaccoReporter.test.ts` and `src/lib/storyListEmail.test.ts` cover copying, sanitizing, sources, links, headline refresh, ad placement (ad, 1, 2, ad, 3, 4, ad, 5), running out of ads, escaping and unsafe links.
- The SQL was applied twice to a copy of the local database; the resulting tables, columns, enums, indexes and constraints matched what Payload generates exactly.
- Against a scratch copy of the local database: three real Tobacco Reporter posts were added through the admin picker, a heading was saved, the order changed and saved, and the preview and published web edition rendered with images at desktop and phone width (no horizontal scroll). A pasted permalink resolved to the right post.

## Verification of part 2 (2026-11-18)

- `digest.test.ts` covers the week range (including a month boundary and the end of daylight saving), collecting stories across issues without repeats, heading order with unfiled and deleted headings, readiness, and HTML-to-PDF conversion. `digestPdf.test.ts` renders 18 multi-paragraph stories under three headings and checks with pdf.js that every story's text and source links are present, every contents page number matches the page its destination is on, the ad is before the first section, "Page n of N" is on every page and characters such as Māori, € and ₱ render. `storyListEmail.test.ts` covers the weekly email (one ad, download link, no story bodies).
- The SQL was applied twice to a copy of the local database; the enums matched what Payload generates exactly.
- In the browser against a scratch copy of the local database: eight real Tobacco Reporter posts in two published daily issues (plus a draft), "Add this week's DES stories" collected the eight and reported the skipped draft, unfiled stories were filed and one was dragged into another heading, the draft was saved, and Generate PDF produced a six-page PDF with correct contents page numbers and a test ad, attached to the issue; the email preview showed the summary, ad and download button.

Note for local testing: the local `.env` points uploads at the same S3 bucket as beta. Files uploaded locally (images copied from Tobacco Reporter, generated PDFs) land in that bucket; delete test records through Payload so their objects are removed.
