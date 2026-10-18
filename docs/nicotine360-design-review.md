# Nicotine360 beta: design finishing touches

Historical review. The October 15 implementation and verification handoff is [frontend-experience.md](./frontend-experience.md); use that for current behavior rather than treating these original checkboxes as outstanding work.

Oct 14, 2026 · @Papa

The bones are good (a sensible navy and orange palette, Inter with Source Serif, a clear structure), but the site reads as a prototype because of unstyled form controls, emoji icons, underlined everything, empty-feeling pages and internal wording left visible to users. Reviewed while logged in as a Premium user on 14 pages plus detail views, at 1440px desktop and 390px phone width, with styles read from the live CSS.

## Top fixes

If you only do ten things before launch, do these, in this order.

- [ ] **Style every form control.** Text and date inputs fall back to browser defaults (Arial 13px, 2px inset border, square corners) while the dropdowns beside them are styled, so every filter bar looks half-built. Give inputs, selects, checkboxes and buttons one shared style: Inter 15px, 40px tall, 1px #D8DEE6 border, 8px radius, white fill, a 3px primary-tinted focus ring.
- [ ] **Replace emoji with one icon set.** The Data page uses literal emoji (money bag, chart, ship, seedling) and the section icons are a mix of styles. Use a single line-icon family (Lucide, Phosphor or Heroicons outline) at 20px in primary blue, inside a 40px tinted square.
- [ ] **Stop underlining list titles and metadata.** Every list row's title and its grey metadata line are underlined links, which is the single most "1999" signal on the site. Make the whole row the click target, no underline at rest, title turns primary on hover, metadata plain grey.
- [ ] **Hide internal states and jargon from users.** "not sent" / "sent" on issues, "row(s)", "Scraped weekly from the USPTO XML feed", "designed outside the CMS", "Staff-maintained reference tables", "Readable by any Base or Premium subscriber", "AG Grid". Full list in Copy below.
- [ ] **Fix the datasets grid.** Columns stop at about 80% width leaving a white strip, company names truncate ("Philip Morris Internatio..."), only 10 rows show, numbers are left-aligned. Fit columns to width, right-align numbers, give the grid real height, and add the Excel export the pricing card promises.
- [ ] **Give the guide and event pages content.** The US Tax Guide page is a heading and a single underlined "Download PDF" link in a near-empty card; the event page repeats its own name in a card. These are the pages people will share.
- [ ] **Make one consistent page width.** Pages use 830px (lists, guides), 1050px (dashboard, dataset) and 590px (home hero text). Pick two: 760px for reading and 1200px for grids and dashboards.
- [ ] **Fix the mobile trademarks table.** It is 549px wide on a 390px screen, so the whole page shrinks and text becomes unreadable.
- [ ] **Normalize badges and capitalization.** "Premium" on the dashboard vs "premium" on Account; subject tags in ALL CAPS ("SOCIETY & POLITICS") next to Title Case sectors.
- [ ] **Add a real brand moment.** The logo, favicon, social share image and a hero image or illustration on the home page. Right now the only "design" is a blue gradient.

## Color

Keep the navy and orange; deepen the navy, drop the gradient, add one cool data accent and a set of status colors. The current palette (from the site's CSS variables) is sound, but the navy-to-steel-blue gradient on the hero and closing band is the look of a 2015 SaaS template, and nothing in the palette says "data".

| Role | Now | Suggested | Use for |
| --- | --- | --- | --- |
| Brand navy (new) | none | #0E2A47 | Hero and footer backgrounds, solid, no gradient |
| Primary | #285888 | #285888 (keep) | Links, active nav, primary buttons |
| Primary dark | #1C4066 | #1C4066 (keep) | Hover and pressed states |
| Secondary | #5890B0 | #5890B0 (keep, sparingly) | Chart series 2, subtle highlights |
| Data accent (new) | none | #12A594 (teal) | Charts, "new" markers, data-page accents, focus of the Premium tier |
| Energy / CTA | #E2592F | #E2592F (keep) | Only the one main call to action per screen |
| Ink | #1A2330 | #0F1722 | Headings |
| Body text | #1A2330 | #1A2330 | Body copy |
| Muted | #5B6878 | #5B6878 (keep) | Metadata, captions |
| Border | #D8DEE6 | #E3E8EE | Lighter hairlines so cards stop looking outlined |
| Page background | #F7F8FA | #F7F8FA (keep) | |

- **Replace the gradient** with solid #0E2A47 plus a faint texture: a 1px dot grid or contour-line pattern at 6% white opacity. That reads "data platform" instead of "template".
- **Orange is the button color, only.** On the home hero it currently sits next to an outlined white button, which is right; don't let orange spread to badges or icons.
- **Status colors for legislation and trademarks.** Add a small semantic set and use it as pill backgrounds: Introduced/In committee (blue tint #E8F0F8 on #285888), Passed one chamber (amber #FFF4DB on #8A5A00), Enacted/Registered (green #E3F5EC on #146C43), Failed/Cancelled (grey #EEF0F3 on #5B6878).
- **Tier badges.** Base = blue tint, Premium = navy fill with white text or a teal accent. The current peach Premium pill reads like a warning label.
- **Grid header.** The AG Grid header is a heavy navy bar. Use a light header (#F1F4F8, ink text, 600 weight) and let the data carry the color.

## Typography

Keep Inter and Source Serif 4, but give the serif fewer jobs: it should mark editorial moments (page titles and headlines), and Inter should run everything that is interface. Today the serif is on card titles, list titles, section headings and even the footer column labels, which makes the UI feel bookish rather than technical.

| Element | Now | Suggested |
| --- | --- | --- |
| Page title (H1) | Source Serif 600, 32px | Source Serif 600, 40px desktop / 30px phone, letter-spacing -0.01em |
| Home hero headline | Source Serif, wraps to 3 lines in a 590px column | Same face at 52px, column widened to 760px so it sits on two lines |
| Section heading (H2) | Source Serif | Inter 600, 22px, ink color |
| Card and list titles | Source Serif, underlined blue | Inter 600, 17px, ink; primary on hover, no underline |
| Article / bill headline on list pages | Source Serif, underlined | Source Serif 600, 19px, ink, no underline (the one place lists keep the serif) |
| Body | Inter 16px / 1.55 | Inter 16px / 1.6, max 70 characters per line |
| Metadata line | Inter ~13px, underlined | Inter 13px, muted, never underlined; separate parts with a middle dot and a little space |
| Labels and eyebrows | Footer labels in serif caps | Inter 12px, 600, uppercase, letter-spacing 0.06em, muted |
| Form controls | Arial 13.3px (browser default) | Inter 15px |
| Numbers in tables and grids | Proportional | Inter with `font-feature-settings: "tnum"` so digits line up |

- **One weight ladder:** 400 body, 500 nav and buttons, 600 headings. Avoid 700+ except the logo.
- **Links in running text** keep an underline, but make it subtle: `text-decoration-thickness: 1px; text-underline-offset: 3px;` in a 40% tint, full color on hover.
- **Dates.** Write them as "Oct 12, 2026" in lists and detail pages instead of "10/12/2026"; it reads as edited rather than database output, and is unambiguous for international users.

## Layout and components

The site is "a white bordered box on a grey page" everywhere, and it is the repetition of that one move, more than any single choice, that feels unfinished. Vary it: some content in boxes, some open on the page, and give every page a proper header band.

**Page header band**

- Every section page (News, Legislation, Data, Guides, Publications, Events) gets a header band: white background, 48px top and bottom padding, a 12px uppercase eyebrow ("Tracking", "Data"), the H1, a one-line description, and on the right a count or freshness line such as "1,284 articles · updated today".
- Move the icon into a 40px tinted square left of the eyebrow, not floating beside the H1.
- Add breadcrumbs on detail pages ("Legislation / Puerto Rico / H.1465") in place of the underlined "← All bills" link.

**Header (top navigation)**

- The logged-out header is 68px tall and the logged-in one 54px; pick 64px for both so the page doesn't jump after login.
- Logged in, collapse "Dashboard · Account · Log out" into an avatar or initials button with a menu; add a search icon that opens site-wide search (the most-used action on an intelligence site).
- Mark the current section in the nav with a 2px primary underline.
- Dropdowns: the Data mega-menu is good structurally. Add a one-line description under each dataset name in muted 13px and a "View all data →" footer link; widen columns so titles wrap less.

**Filters**

- Lay filters out as one horizontal toolbar: keyword search (wide, with a magnifier icon) first, then compact dropdown "chips" for Sector, Product, Subject, Location and a single date-range picker. Apply automatically on change and drop the "Apply filters" button, or keep it but align it on the same row.
- Show active filters as removable pills under the toolbar with a "Clear all" link and the result count ("Showing 214 of 18,614").

**Lists (articles, bills, issues, guides, publications)**

- Remove the outer card around the list; let rows sit on the page with a hairline divider, or give each row its own light card with hover lift. Not both.
- Row anatomy: source favicon or jurisdiction flag (16px) · headline · one-line summary in muted text (two lines max) · metadata row with pills (subject, location, status).
- Pagination or "Load more" at the bottom with a count; the articles page currently renders a 9,000px column.

**Cards (home and dashboard tiles)**

- Same height, 24px padding, icon top-left, title, one-line description, and a quiet "→" that slides 4px on hover.
- Add a live number to each dashboard tile: "38 new this week", "12 bills moved", "126 trademarks filed". This one change makes the dashboard feel like a product instead of a sitemap.
- The dashboard grid has 4 tiles on row one and 3 on row two with an empty slot; use 3 + 3 + a wide "Your publications" tile, or 4 + 4 with a Search tile.

**Tables and grids**

- Right-align numbers and percentages, left-align text; zebra stripes off, row hover on.
- Columns fit to container width (AG Grid `sizeColumnsToFit` or flex columns) so there is no empty strip on the right.
- Grid height: fill the viewport (about `calc(100vh - 280px)`, minimum 480px) instead of ten rows.
- Toolbar above the grid: quick search, a column chooser, "Download" as a split button (CSV, Excel), and the last-updated date.

**Buttons**

- Three variants only: primary (orange, for the one main action), secondary (navy fill), and outline (navy border). 40px tall, 8px radius, Inter 500 15px. The account page "Save preferences" button is currently an unstyled browser button.

**Footer**

- Switch to the solid brand navy with white and 70%-white text so the page has a clear end. Add the organization's logo or name ("A publication of the Nicotine Resource Consortium"), a privacy policy and terms link, and LinkedIn.
- "Log in" in the logged-out home footer CTA points to /account; point it to /login.

## Page by page

| Page | What to change |
| --- | --- |
| Home (logged out) | Widen the hero so the headline sits on two lines, put an image or product screenshot on the right half (see Imagery), and add a proof strip under the hero: subscriber company logos if you have permission, or headline numbers such as subscribing companies served, articles indexed, bills tracked and datasets (use your real counts). The six section tiles are text-only; add a one-line sample of what's inside ("Latest: China destroys seized tobacco products…"). The single upcoming-event card is a thin bar; make it a wide card with the event image, dates, city and a "Get tickets" button. In "Two ways to subscribe", make the Premium card the visually heavier one (navy fill or teal top border) and add a "Talk to us" button under each card rather than only a text link. |
| Home (logged in) | Shows the same marketing hero with "Go to your dashboard". Send logged-in users straight to the dashboard, or replace the hero with a "Today" strip: latest Daily Executive Summary, newest bills, newest trademarks. |
| Login | Fine structurally but the card is 830px wide for two fields. Narrow it to 420px, center it, add the logo above, "Remember me", and a short line on the left or below: "Use your work email; if your company subscribes you're in automatically." The email field shows a heavy black focus ring; use the shared primary focus ring. |
| Dashboard | Add live counts and "new since your last visit" to each tile, a "Your publications" panel with the latest issue of each one the user subscribes to, and a "Recently viewed" list. The "Plan: Premium" line can move into the avatar menu or a small line under the greeting with the company name. |
| News | Header band, toolbar filters, rows without underlines, one-line summary under each headline, subject shown as a pill in sentence case, pagination. Show the source name ("BBC") rather than the raw domain ("www.bbc.com"). |
| News article | The body card repeats the headline as its only content. Show the summary or first paragraph, a prominent "Read at BBC →" button, and move index terms into a right sidebar of clickable pills (each one filters the News list). Add "Related articles" below. |
| Legislation | Lead each row with the jurisdiction ("Puerto Rico") and a status pill in the semantic colors; drop the "State/Province" label, which is the database level name. Put the bill number in a monospaced or tabular-number chip and the title in the headline style, so "H.1465 — Prohibits Disposable Vaporizers (PR26-H.1465)" becomes chip "PR H.1465" + "Prohibits Disposable Vaporizers". |
| Bill detail | Turn the Status table into a vertical timeline (dot, date, action). Hide the "Full text" card when there is none instead of "Full text not yet available." Fill the empty Actor column or drop it. Index terms to a sidebar as above. |
| Trademarks | Show the mark image as a 48px thumbnail in the first column; the weekly USPTO pull already downloads these images. Sentence-case the owner names or leave them as filed but in regular weight. Add a status pill (Published, Registered, Cancelled). |
| Trademark detail | Large mark image at top, then a two-column fact sheet. Hide fields that are empty (Owner address, Style/Design, Registered, Cancelled, Renewed all show "—") rather than listing them. Add a "View on USPTO →" link. |
| Data | Replace emoji with icons; turn the list into a card grid (3 across) with a small sparkline or chart thumbnail, the dataset's coverage ("190 countries · 2010–2025") and last-updated date instead of "334 row(s)". |
| Dataset grid | See Tables and grids. Also add a chart tab above the grid for the obvious view (market share by company as bars for the selected country), and a country selector rather than a filter icon in the header. |
| Guides | Only five guides, shown as a bare underlined list. Make them five tall cards with a cover thumbnail (the PDF's first page), the edition date, page count and a "Download PDF" button. |
| Guide detail (US Tax Guide) | Currently just a title and a "Download PDF" link. Add the cover image, a summary paragraph, "What's inside" (the table of contents), the edition date and file size, a primary "Download PDF (1.3 MB)" button and, for the US guide, the state tax map image you already have. |
| Publications | Group heading + list works; add the cadence as a pill ("Daily", "Weekly") instead of trailing "· daily", a "Subscribe" toggle on each row so users don't have to go to Account, and a thumbnail of the email masthead. |
| Publication issue list | Remove "not sent" / "sent". Title rows by date only ("Monday, October 12, 2026") since the publication name is already the page heading. Group by month. |
| Issue detail | The trademark report is a 2,900px bulleted list of underlined brand names. Render it like the email: grouped, with mark thumbnails and owner, in a table or cards. Replace "← Back" with a breadcrumb to the publication. |
| Events | Lists past events oldest-first with the 2027 event last. Split into "Upcoming" (big cards with image, date, city, ticket button) and "Past events" (compact list, newest first, with replay links for registrants). Drop "Thank You!" as a subtitle. |
| Event detail | The first card just repeats "ATNF 2027". Use a hero with the venue or past-event photo, dates, city and a ticket button; then About, Agenda, Speakers, Venue, Sponsors. When tickets aren't on sale, say when they will be and offer "Notify me" instead of "No ticket types are currently on sale for this event." |
| Account | Lay it out as a left sub-nav (Profile, Access, Email preferences, Purchases) with one panel at a time. Make the preference list a set of toggle switches with name in 500 weight and description muted on its own line. Department and Business sector show "—"; make them editable fields with an "Edit profile" button. "Via Nicotine Resource Consortium (live, premium)" should read "Provided by Nicotine Resource Consortium · Premium". |

## Mobile

The mobile menu and card stacking work; the problems are a table that overflows and controls sized for desktop.

- **Trademarks list overflows:** the table renders 549px wide on a 390px phone, so the browser shrinks the whole page and the text becomes tiny. Below 640px, switch each row to a stacked card (mark image, brand name, owner, date), or wrap the table in a horizontal scroller with a sticky first column.
- **Dataset grid:** only two columns fit and the pager is cut off ("1 to 50 of 3,58…"). On phones, pin the first column, let the rest scroll horizontally, and simplify the pager to "‹ Page 1 of 72 ›".
- **Filters take a full screen** before any results appear. Collapse them behind a "Filters (2)" button that opens a bottom sheet; keep the keyword search visible.
- **Form controls are 13px.** iOS zooms the page when a field under 16px is focused; set inputs to 16px on small screens.
- **Dashboard tiles** stack as tall cards with a lot of empty space; use a 2-column grid of compact tiles at phone width.
- **Mobile menu:** the Data section expands into a long list of dataset names. Collapse each top-level section into an accordion and show only section names until tapped; put Log in / Account at the top of the menu.
- **Tap targets:** list metadata links and footer links are under 44px tall; give rows full-width tap areas.

## Copy that gives the prototype away

These strings are developer or admin language that users can see today. Each is small, but together they are a large part of the "prototype" feel. Figures and dates in the suggestions are examples; swap in the real ones.

| Where | Now | Suggested |
| --- | --- | --- |
| Issue lists | "10/12/2026 · not sent" | "Oct 12, 2026" (hide send status from users) |
| Trademarks intro | "Scraped weekly from the USPTO XML feed: filings, renewals, cancellations. No public preview — the whole listing requires a Base or Premium subscription." | "New tobacco and nicotine trademark filings, renewals and cancellations from the USPTO, updated every week." |
| Data intro | "Staff-maintained reference tables." | "Market, tax and trade data, researched and updated by our analysts." |
| Data list | "· 334 row(s)" | Coverage and freshness: "190 countries · updated Sep 2026" |
| Guides intro | "Readable by any Base or Premium subscriber." | "In-depth reference guides to tax, trade and regulation." |
| Publications intro | "Newsletters, readable by any Base or Premium subscriber." | "Daily and weekly briefings, delivered to your inbox and archived here." |
| Monthly Research Digest | "A monthly custom-HTML roundup designed outside the CMS." | "The month's most important research on nicotine and tobacco, summarized." |
| Dashboard Data tile | "Market, tax and trade datasets in AG Grid." | "Market, tax and trade datasets you can filter and download." |
| Home pricing card | "Full AG Grid access with CSV/Excel export" | "Interactive tables with CSV and Excel export" |
| Bill metadata | "State/Province" | The actual jurisdiction name ("Puerto Rico") |
| Bill detail | "Full text not yet available." | Hide the section |
| Event detail | "No ticket types are currently on sale for this event." | "Registration opens in January. Get notified →" |
| Event list | "ATNF 2026 · Thank You!" | The event's theme or city |
| Account | "Via Nicotine Resource Consortium (live, premium)" | "Provided by Nicotine Resource Consortium · Premium" |
| Index terms | "SOCIETY & POLITICS" | "Society & politics" (sentence case everywhere) |
| Trademark report | "← Back" | Breadcrumb to the publication |

Also check the page `<title>` and meta description on each page, and add an Open Graph image so links shared in email and LinkedIn show a branded card.

## Imagery

The strongest "technologically capable" image you can show is your own product: real screenshots of the dashboard, a dataset grid and a chart, framed in a clean browser mockup. Use photography for events and for a little atmosphere in page headers, and keep it to one consistent treatment.

**Ground rules**

- No people smoking or vaping, no cigarette close-ups, no smoke wisps or vape clouds. They read as either advertising or anti-smoking campaigns, and a trade intelligence service should look neutral and analytical.
- No handshake, lightbulb or generic "business people pointing at a laptop" stock, and nothing that looks AI-generated.
- One treatment for all photos: cool, slightly desaturated, or a navy duotone (shadows #0E2A47, highlights white) so mixed sources look like one set.
- Prefer architecture, landscapes, documents and real event photos over posed people.

**Where images go and what to look for**

| Spot | Look for | Size |
| --- | --- | --- |
| Home hero (right half) | A product shot: the dashboard and a dataset chart in a browser frame, slightly angled with a soft shadow, over the navy background. Second choice: an aerial photo of tobacco fields in rows, high and wide, early-morning light, duotoned. | 1600 × 1200, WebP |
| Home "what you get" section | Three small product screenshots: a filtered news list, a bill status timeline, a market-share chart. | 800 × 600 each |
| News header | Abstract world map with location dots, or a macro of a printed newspaper page, out of focus, duotoned. | 2400 × 480 banner |
| Legislation header | A state capitol dome or legislative chamber, symmetrical, shot from below, plain sky. Avoid the US Capitol only, since coverage is state and international. | 2400 × 480 |
| Trademarks header | Close-up of embossed packaging or foil stamping on a plain carton, no brand legible; or a neat grid of real mark thumbnails from the feed. | 2400 × 480 |
| Data header and cards | No photo. Use small sparkline or bar-chart thumbnails generated from each dataset. | 320 × 160 |
| Guides | The cover of each PDF as a thumbnail with a slight page shadow; the US Tax Guide map image you already have for the US guide page. | 600 × 800 |
| Publications | A cropped screenshot of each newsletter's email masthead. | 600 × 300 |
| Events (ATNF, GTNF) | Your own photos from past forums: wide stage shots with branded backdrop, panel speakers mid-sentence, a full room from the back, networking at the reception. Ask your event photographer for 10–15 landscape selects per event. Add a venue or city photo for upcoming events with no photos yet. | 1600 × 900 |
| Login and sign-up | A narrow side panel with the navy texture and one short value line; no photo needed. | |
| Open Graph share card | Logo, page title and the navy texture, generated per page if possible. | 1200 × 630 |
| Favicon | The logo mark alone as an SVG, plus a 180 × 180 Apple touch icon. | SVG |

Good search terms on Unsplash, Pexels or Adobe Stock: "state capitol dome", "legislative chamber empty", "tobacco field aerial", "tobacco leaves drying barn", "world map dots dark", "embossed packaging macro", "conference panel stage wide". Check each licence permits commercial use.
