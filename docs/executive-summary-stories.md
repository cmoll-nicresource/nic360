# Executive Summary stories (Daily Executive Summary)

Status: part 1 built 2026-11-18 (daily issue). Part 2, the weekly Executive Summary organizer and PDF, is not built yet.

## Why

Daily Executive Summary (DES) stories are Mike's own write-ups, also posted on Tobacco Reporter (tobaccoreporter.com, which we own). They are not clippings, and they should not appear as browsable news on Nicotine360. Before this, the DES was written and sent from Mailchimp and only a PDF reached the site.

Now an editor builds the DES in Nicotine360 from Tobacco Reporter posts. Each story is **copied** into a `summary-stories` record when it is added, so the archived issue keeps its text even if the post changes. Stories have no pages of their own; subscribers see them only inside an issue, which checks the plan as before.

Going forward, everything in the DES is posted on Tobacco Reporter first.

## Editor workflow

1. Set the Daily Executive Summary publication's **Format** to *Tobacco Reporter stories* (once). New issues then default to it.
2. Create an issue. Under **Stories**, click **+ Add from Tobacco Reporter**: the newest posts are listed; search, or paste a Tobacco Reporter link.
3. For each story, change the headline if needed and choose its **weekly heading**. Both save to the story immediately. The heading is only for the weekly Executive Summary; it is not shown in the daily email.
4. Drag (or use ↑ ↓) to set the running order. The list marks the ad slots: before story 1, 3, 5…, the same rule as other publications. Save the issue.
5. If a post is edited on Tobacco Reporter, click **Refresh** on that story. Refresh re-copies the text, sources and image; it keeps the weekly heading and any headline the editor changed. Issues already sent keep the email HTML they were sent with.
6. Preview, send a test, publish and send as usual.

The headings list (Publishing > Executive Summary headings) is editable and drag-to-reorder. It was seeded with the 13 headings used in the 6 November 2026 weekly edition.

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
| Schema | `migration/executiveSummaryStories.sql` via `migration/prepareExecutiveSummaryStories.ts` (preview; `--apply`) |

## Verification (2026-11-18)

- `src/lib/summaryStories/tobaccoReporter.test.ts` and `src/lib/storyListEmail.test.ts` cover copying, sanitizing, sources, links, headline refresh, ad placement (ad, 1, 2, ad, 3, 4, ad, 5), running out of ads, escaping and unsafe links.
- The SQL was applied twice to a copy of the local database; the resulting tables, columns, enums, indexes and constraints matched what Payload generates exactly.
- Against a scratch copy of the local database: three real Tobacco Reporter posts were added through the admin picker, a heading was saved, the order changed and saved, and the preview and published web edition rendered with images at desktop and phone width (no horizontal scroll). A pasted permalink resolved to the right post.

## Part 2 (next)

Weekly Executive Summary: "Build from this week's DES issues" gathers Monday–Thursday stories under their weekly headings, Mike adds Friday's, drags to adjust, and generates the PDF (cover, linked contents, the one advertiser after the contents, sections and stories with sources) with the existing `@react-pdf/renderer` tooling.
