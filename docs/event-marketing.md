# Event marketing pages

The public pages that promote ATNF, GTNF and InFocus. They replace what the Webflow sites (atnf.forum, gtnf.org) do today: forum home page, about, events list, sponsors and "partner with us". Nothing on them needs a login; registration, livestream and replay stay on the event page behind the existing account rules.

## Pages

| Page | What it shows |
|---|---|
| `/events` | Links to each forum, sponsor band for upcoming events, upcoming and past events |
| `/events/channels/:channel` (`atnf`, `gtnf`, `infocus`) | Forum home page: next event with dates and calls to action, sponsor band, about copy, where it has been held, upcoming and past events, partner and contact details |
| `/events/:slug` (e.g. `/events/gtnf-2027`) | Event page: sponsor band, about, who attends, agenda (draft or full), confirmed speakers, venue and travel, practical information, highlights, sponsors, partner with us, registration with key dates and add-to-calendar |
| `/events/:slug/calendar.ics` | Calendar file for the event |

Forum copy (full name, summary, about paragraphs, host history, media address, social links) lives in `src/config/channels.ts`, because it changes rarely. Everything that changes each year is a field on the event.

## Page addresses

Every event has a **Page address** (`slug`) in the sidebar of its admin screen. It is built from the name when the event is first saved ("GTNF 2027" becomes `gtnf-2027`; a second event with the same name gets `-2`), and staff can type their own. Renaming an event does not change its address. Changing the address by hand breaks links already shared, because old addresses are not remembered.

The record id still works everywhere: `/events/12` redirects to the readable address, and the livestream, checkout return and calendar addresses accept either form. The page declares the readable address as canonical for search engines. `eventPath()` in `src/lib/eventLinks.ts` builds every public event link.

## Draft agenda, then full agenda

Each event has **Agenda shown on the event page** (`agendaMode`):

- **Draft agenda**: shows the **Draft agenda** rich text field under a "Draft programme, subject to change" notice with the date the event was last updated. Paste the programme straight from Word; headings, bold text and lists are kept. No sessions, times or speakers are needed.
- **Full agenda**: shows published Sessions grouped by day, in time order, with room, moderators, speakers and custom speaker groups. Each name links to that person's entry in the speakers section. Sessions without a start time are listed after the timed ones as "Time to be confirmed".

Switching to the full agenda keeps the draft text; it is just no longer shown. If the chosen agenda has nothing behind it, the page shows the other one, so a programme is never hidden by the setting (`agendaView` in `src/lib/eventAgenda.ts`). New events start on Draft. Events from before this setting have it empty and are treated as Full.

The speakers section is the event's **Speakers** list, in the order staff set. It is titled "Confirmed speakers" until the event ends. With the full agenda on, anyone named on a session but missing from that list is added at the end so their name has somewhere to link.

## Session times

A session's start and end are the venue's clock time, typed as-is on the event dashboard or the session form, whatever timezone the member of staff is in. The agenda shows them unchanged with the venue's zone ("All times are local to the venue (EDT)"). The attendee report converts them with the event's **Event timezone** to match livestream presence. See `src/lib/sessionTime.ts`.

Before this change the two entry screens saved the editor's own local time, which disagreed with the migrated agendas. Sessions typed into beta before the change may show the wrong time and should be re-entered; migrated sessions are unaffected.

## Sponsor band

`SponsorMarquee` appears on all three pages. It shows the event's sponsors (logo, or name when no usable logo is uploaded), each linking to the sponsor's website. Five or more sponsors scroll continuously; it pauses under the pointer or keyboard focus, and becomes a plain scrollable row for visitors who ask for reduced motion. Fewer than five stand still. Between events, a forum's home page keeps showing the sponsors of its most recent event.

## Who attends, key dates, practical information, highlights

All four are optional and each section is hidden until it has content. They sit in collapsed groups on the event's admin screen.

- **Who attends** (`audience`): up to a handful of headline figures (a value and a label, such as "400+" and "delegates") and a short description of who is in the room. Shown on the event page and on the forum home page, which uses the nearest upcoming event that has them, then the most recent past one.
- **Key dates** (`keyDates`): a label and a date, such as "Early-bird rate ends" or "Hotel room block closes". Shown above the ticket prices in date order, with a countdown in the last 30 days and struck through once passed. **These are notices only.** They do not change a ticket price or close registration; staff still change the price, or set the discount code's expiry, on the day.
- **Practical information** (`faq`): questions and rich text answers that open in place. Intended for dress code, visa letters, refunds and substitutions, accessibility, code of conduct, and recording or attribution rules.
- **Highlights** (`highlights`): a public Vimeo or YouTube link, photos (the first eight are shown) and delegate quotes. They appear on the event's own page once it has ended, on the forum home page, and on the next event's page under "Highlights from …" (the most recent earlier event in the same forum that has any). A video link from any other site is shown as a link, not embedded.

## Calendar and search listings

"Add to calendar" on an upcoming event offers a calendar file (Outlook, Apple) and a filled-in Google Calendar link. A forum that runs over several days is added as an all-day block. A one-day event with timed sessions and an event timezone is added at its real start and end, worked out from the venue clock; otherwise it is all day.

Each event page also carries schema.org `Event` data (dates, venue or online location, image, speakers, and the public non-subscriber prices while registration is open), which search engines use to show the event in results. See `src/lib/eventCalendar.ts` and `eventStructuredData` in `src/lib/eventMarketing.ts`.

## Other event fields

- **Getting there** (`venue.transportation`): airports, trains, parking, shuttles. Shown under Venue & travel with a map link built from the Location text.
- **Accommodation**: the description, hotel phone, hotel email and booking link now all appear under "Where to stay".
- **Partner with us** (`sponsorship`): this event's packages and prices, with a button that emails the forum's contact address. Hidden once the event has ended.
- **Receive-updates link** (`updatesUrl`): optional link to a sign-up form, shown on the event and forum pages until the event ends.

## Deploying

Apply the additive schema before deploying the code to an existing database:

```sh
pnpm exec tsx migration/prepareEventMarketing.ts          # rolled-back preview
pnpm exec tsx migration/prepareEventMarketing.ts --apply  # additive transaction
```

It adds nullable columns to `events` and its versions table, two enum types, a `media_id` column on the events relationship tables, and eight new empty tables for the lists (figures, key dates, questions, quotes, and their version copies). The only existing data it writes is the new `slug` column, filled from each event's name; when two events share a name the earliest keeps the plain address and the others get their record id appended. Nothing is dropped or rewritten, and it is repeatable.

Run it **before** the code reaches the server: the new code reads these columns, so event pages and the event admin screen fail until they exist, while the current code ignores them. On Railway the database has no public address, so the step runs from inside the project (`railway ssh`/`railway connect`); the app redeploys by itself when `master` is pushed.

## Tests and verification

`src/lib/eventAgenda.test.ts` and `src/lib/sessionTime.test.ts` cover the agenda choice, grouping and ordering, speaker lists, link safety and timezone conversion, including daylight saving. `eventLinks.test.ts`, `eventCalendar.test.ts` and `eventMarketing.test.ts` cover addresses, calendar windows and file format, key dates, highlights, video links and the search listing data. The migration was checked against a copy of the current local schema holding the real event names: preview rolls back, apply is repeatable, an existing event keeps an empty agenda mode, every event and version receives an address, and the resulting tables, indexes and constraints match what Payload generates (column order aside). The pages were checked in a browser at desktop and phone width on a throwaway seeded database; they have not been deployed to beta.
