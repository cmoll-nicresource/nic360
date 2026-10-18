# Nic360 entity map

Living map of the site's content entities, written toward Payload CMS (Next.js + Postgres) with content gated by login / base / premium tiers set by the user's employer organization. Add new entities as new sections; keep the shared pieces in "Shared building blocks" so they stay in one place.

Source for this first pass: *N360 Excerpt Types.docx* (Papa, 2026-10-08), which shows the current admin screens for Articles, Bills and Trademarks. Field names below are the current UI labels; `camelCase` is the proposed Payload field name.

## Overview

Current import transaction guarantees, parent-scoped PDF file access, webhook verification, and seed protections are documented in [import-and-access-safety.md](./import-and-access-safety.md). These supersede the earlier prototype shortcuts described in the historical notes below.

Current user layouts and data-explorer behavior are documented in [frontend-experience.md](./frontend-experience.md); staff routes and their permissions are in [admin-workspace.md](./admin-workspace.md).

```
                ┌──────────── Taxonomies (shared lookups) ────────────┐
                │ Sectors · Products · Subjects (tree) · Locations     │
                └──────┬───────────────────┬───────────────────────────┘
                       │ index terms       │ index terms
                 ┌─────▼─────┐  related  ┌─▼────┐        ┌────────────┐
   Sources ◄─────┤ Article   │◄──────────┤ Bill ├──has───► BillAction  │ (array rows)
                 └───────────┘ articles  └──────┘        └────────────┘
                                                   ┌───────────┐
                  USPTO feed ─────────────────────►│ Trademark │──► Media (image)
                                                   └───────────┘
```

**"Excerpt" = the umbrella name** for anything we collect from outside and index: Article, Bill and Trademark today.

**Recommendation: three separate Payload collections, not one `excerpts` collection with a type switch.** They share only a thin core (title, location, index terms, publish state); their required fields, ingestion sources and validation differ a lot, and Trademarks have no index terms (confirmed). Separate collections give each its own Postgres table and admin screen. Shared pieces become reusable field definitions, and anything that lists "all excerpts" (search, feeds, related-content pickers) uses Payload's multi-collection relationships and the search plugin across the three.

## Shared building blocks

### Excerpt core (on every excerpt type)

| Field | Payload type | Notes |
|---|---|---|
| `title` | text, required | Article Title / Bill Title / Trademark Brand Name |
| `_status` / `publishedAt` | Payload drafts | Draft vs published; not visible in the screenshots |
| `ingestion` | group: `source` (manual · statenet · uspto · extension), `externalId`, `importedAt` | **Proposed.** Lets importers upsert without duplicates |

### Index terms (Article and Bill only; Trademarks stay unindexed)

| Field | Payload type | Notes |
|---|---|---|
| `locations` | relationship → Locations, hasMany, required | "Add Location" with address autocomplete; e.g. *Kenya*, *Pennsylvania, USA* |
| `sectors` | relationship → Sectors, hasMany, required | e.g. *Manufacturers*, *Retail & Distribution*, *Social* |
| `products` | relationship → Products, hasMany, required | e.g. *All Products* |
| `primarySubject` | relationship → Subjects, required | UI is a chip picker; examples always hold one value, so modelled as single |
| `subjects` | relationship → Subjects, hasMany, required | Hierarchical: *RETAIL, DISTRIBUTION, & SALES > Licensing (sales)* |

### Taxonomy collections

| Collection | Shape | Notes |
|---|---|---|
| Sectors | name | Flat list |
| Products | name | Flat list; includes a catch-all *All Products* |
| Subjects | name, `parent` → Subjects, `legacyId` | Tree (parent > child); use Payload's nested-docs plugin. `legacyId` (old site's `taxonomies.id`) only exists to match `excerpt_indices` rows during migration — 97 of the old site's 855 subject names repeat under a different parent, so name alone can't identify a node |
| Locations | name, `parent` → Locations, `level` (region · country · state/province · city), geo point | Fed by the address autocomplete; one record per place, reused. Hierarchy (e.g. Pennsylvania > United States > North America) lets publication rules and filters match a place and everything inside it |
| Sources | name/domain | **Proposed.** Article "Source Title" holds a domain (*thekenyatimes.com*), which repeats across articles |
| BillTypes | name | e.g. *Bill*; small select list could also be a plain `select` |
| GovernmentLevels | name | e.g. *State/Province*; likely a fixed `select` (Federal, State/Province, Local, International) |

## Article

News found across the internet; we take the title and a preview and apply index terms.

Migration correction (October 16): the old curated news excerpt is `short_abstract`, not `full_text`. The initial importer silently substituted headlines. The corrected importer decodes COPY fields and prefers the curated excerpt; a separate backed-up repair restored 8,513 base/latest-version excerpts locally and on beta, with 823 already-correct records and 94 original-source gaps. See [article excerpt recovery](./article-excerpt-recovery.md). Earlier dated migration notes describing the `full_text` mapping are superseded by this correction.

| UI label | Field | Payload type | Req. |
|---|---|---|---|
| Article Title | `title` | text | ✓ |
| Source Title | `source` | relationship → Sources (or text) | |
| Source Link | `sourceUrl` | text (URL) | |
| Source Date | `sourceDate` | date | |
| Article Excerpt | `excerpt` | richText (headings, lists, table) | ✓ |
| Location, Sectors, Products, Primary Subject, Subjects | index terms | see above | |

### Browser extension (`tma-ext/`)

The standalone MV3 News Clipper creates draft Articles with reviewed metadata. Version 2.2 connects through website staff sign-in and explicit approval, using a single-use PKCE code and revocable 12-hour opaque credential stored only on the device. It cannot authenticate against the full CMS API. Staff manage their own connections at `/admin/connected-browsers`. See [news clipper](./news-clipper.md) for routes, security boundaries, schema migrations, upgrade instructions and tests.

## Bill

Legislation tracked via StateNet, summarized and categorized. Admin screen has two tabs (Content, Index), which map directly to Payload `tabs`.

**Content tab**

| UI label | Field | Payload type | Req. in UI |
|---|---|---|---|
| Bill Type | `billType` | relationship/select | ✓ |
| Bill Number | `billNumber` | text, e.g. *H.1434* | ✓ |
| Title | `title` | text | ✓ |
| Location | `locations` | index term | |
| Bill Session | `session` | text/select, e.g. *Regular* | ✓ |
| Law Number | `lawNumber` | text | ✓* |
| Government Level | `governmentLevel` | select | |
| Action URL | `actionUrl` | text (URL) | ✓* |
| Bill URL | `billUrl` | group: `title`, `url` | ✓ (title blank in example) |
| Carried By | `carriedBy` | text (sponsor) | ✓* |
| Bill Date | `billDate` | date | ✓ |
| Approval Date | `approvalDate` | date | ✓* |
| Effective Date | `effectiveDate` | date | ✓* |
| Abstract | `abstract` | richText | ✓ |
| Full Text | `fullText` | richText | ✓ |

**Index tab**

| UI label | Field | Payload type | Req. in UI |
|---|---|---|---|
| Sectors, Products, Primary Subject, Subjects | index terms | see above | |
| Related Articles | `relatedArticles` | relationship → Articles, hasMany | ✓* |
| Latest Activity | `latestActivity` | text, typed by hand, e.g. *Proposed Rule* | |
| Latest Text | `latestText` | text, typed by hand, e.g. *Proposed* | |
| Status Text | `statusText` | text, typed by hand, e.g. *Proposed Rule* | |
| Statute Title / Statute Link | `statute` | group: `title`, `url` (LexisNexis link) | |
| Location (Committee) | `committee` | text, e.g. *N/A* | |
| Bill Actions | `actions` | array, sortable (see below) | ✓ |

\* Marked required in today's UI but blank in the real example record (Law Number, Action URL, Carried By, Approval/Effective Date, Related Articles), so in practice optional. Proposed: make these optional (or required only on publish).

**BillAction (array row inside Bill)**

| Field | Type | Example |
|---|---|---|
| `date` | date | 2026-09-30 |
| `action` | text | *Introduced by* |
| `actor` | text (person or committee) | *Gomez (D)* |

Kept as a Payload `array` (its own child table in Postgres) rather than a separate collection, since actions are never shown or edited outside their bill.

## Trademark

Scraped weekly from the USPTO XML feed (our industry's chapter): filings, renewals, cancellations. No index-term fields on today's screen.

| UI label | Field | Payload type | Req. |
|---|---|---|---|
| Brand Name | `title` | text | ✓ |
| Serial Number | `serialNumber` | text, unique | proposed key for USPTO upsert |
| Class | `class` | text/number (Nice class) | not written by the real import — we only import class 34, so the value would be redundant; left for staff/manual use |
| Company | `owner` | text | |
| Address | `ownerAddress` | text (address autocomplete) | not in the USPTO feed's field set; stays staff-entered only |
| Published Date | `publishedDate` | date | |
| Style | `style` | select: Yes · No · N/A | |
| Design | `design` | select: Yes · No · N/A | |
| First Used Date | `firstUsedDate` | date | |
| Commercial Use Date | `commercialUseDate` | date | |
| Filed Date | `filedDate` | date | |
| Registered Date | `registeredDate` | date | |
| Registered Number | `registrationNumber` | text | |
| Cancelled Date | `cancelledDate` | date | |
| Renewed Date | `renewedDate` | date | |
| Renewed Owner | `renewal.owner` | text | set to the current owner on a Renewed record, same value as `owner` |
| Renewed Address | `renewal.address` | text | not in the feed; stays staff-entered only |
| Goods / Services | `goods` | textarea | every class's `GoodsServicesDescriptionText`, joined with " / " |
| Trademark Image | `image` | upload → Media | optional (was required) — blank when the USPTO image endpoint 404s (word-only marks, or not yet available) |

The event type a user cares about (filing, registration, renewal, cancellation) can be derived from which dates are set, so no separate status field is proposed. Which date(s) get set is driven by the TMOG **section** the record was published under that week, never by its `MarkCurrentStatusCode` — that code is a stale pre-issue snapshot (e.g. a record landing in "Registrations publishing" this week can still carry an old code like 681 instead of 700). See the real import job below for the exact section → field mapping.

## Relationships summary

| From | To | Cardinality |
|---|---|---|
| Article, Bill | Locations, Sectors, Products, Subjects | many-to-many |
| Article, Bill | Subjects (primary) | many-to-one |
| Article | Sources | many-to-one (proposed) |
| Bill | Articles (`relatedArticles`) | many-to-many |
| Bill | BillAction | one-to-many, owned |
| Trademark | Media | one-to-one |
| Every excerpt | (none) | readable by any user whose access provider has a base or premium subscription; see Access |

## Access

Use the [canonical account terminology](./terminology.md): users, subscribers and conference-specific attendees are overlapping concepts. NRC membership is not a site access distinction.

Access is decided mostly by **content type and the user's subscription**, not per item — excerpts and publications carry no access field. **Guides are the one exception**: most require Premium, but a specific guide can opt into Base access via its own field (`requiresPremium`) — see the Guide section above.

| Content | Who can read it |
|---|---|
| Excerpts (Article, Bill, Trademark) | Base or premium subscription |
| Publications and Issues | Base or premium subscription |
| Data | Premium subscription |
| Guides | Premium by default; Base for a specific guide only if `requiresPremium` is turned off on it |
| An Event: conference, webinar or workshop (to be mapped) | Users registered for that event |

- **Access provider** (to be mapped): the employer organization. Subscriptions are bought company-wide, and every user under it gets that provider's tier.
- **Provider with no active subscription** (typically expired): its users have no subscription access. Public content and access to conferences for which they have registered remain separate.
- **Conference attendees**: users registered for a specific conference, whether or not they also have a subscription through an access provider. An account without a provider does not by itself imply attendance.
- **Events** (conferences, webinars, workshops) are the only things sold to individuals; everything else is sold per company.

- **Premium is an add-on**: it includes everything in base and can't be bought without base.
- **No set prices**: most access comes through membership dues in the 501(c)(6) trade organization (dues scale with member market cap). NRC membership is an organizational distinction and is not used for site roles or labels. Staff quote and set up new access providers and their subscriptions by hand in the CMS; only events are sold online.

In Payload, collection-level `access.read` functions check the user's access provider (status, expiry, plan), or their registrations for events. See Accounts below.

## Accounts

Source: *N360 Account Entities.docx* (Papa, 2026-10-08): current Create User, example User, New Access Provider and example Access Provider screens.

```
 AccessProvider 1 ──── * User * ──── * Event   (via EventRegistration, grouped in Orders)
   (company, plan,         (site account)
    status, expiry,
    allowed domains)
```

### User (Payload auth collection `users`)

Anyone with a site account and login credentials. Subscription access and registrations for individual conferences are optional and independent.

| UI label | Field | Payload type | Req. |
|---|---|---|---|
| First Name / Last Name | `firstName`, `lastName` | text | Not enforced at the schema level — see sign-up flow below; the account is incomplete without them |
| Email | `email` | built-in auth email, unique | ✓ |
| Password / Temporary Password | built-in auth | Payload auth handles hashing, "send reset email" and email verification | ✓ |
| Salutation | `salutation` | text/select | |
| Department | `department` | text | |
| Phone Number | `phone` | text | |
| Business Sector | `businessSector` | select, e.g. *Manufacturer/Exporter: Tobacco and Vapor Products/Services* | |
| Timezone | `timezone` | select | |
| Profile Picture | `avatar` | upload → Media (jpg/png) | |
| Status | `status` | select: Active, … | |
| Access Provider | `accessProvider` | relationship → AccessProviders, **single**, optional | |
| Products Purchased | `registrations` | **join** field: event registrations where the user is the attendee (conferences, webinars, workshops). Old product orders are not migrated | |
| *(internal)* | `signup` | group: `code`, `codeExpiresAt`, `completedAt` — sign-up flow state, gatekeeper-only, not user-editable | |
| Last Login | `lastLoginAt` | date, read-only, shown in the admin list | set by an `afterLogin` hook (`src/hooks/setLastLoginAt.ts`) on every successful login; updates only this one field, so it never re-fires the Mailchimp sync or access-provider hooks |

- `accessProvider` is optional for every user. Its absence means no provider subscription access, not that the user is an attendee.
- **Registration rule:** when a user verifies an email whose domain (or exact address) is in a provider's `allowedDomains`, an `afterChange`/verify hook sets `accessProvider` automatically.
- Business Sector here is a sign-up profile list, kept separate from the excerpt Sectors taxonomy (decided: not merged). A plain `select`.
- **Staff accounts** go in a separate auth collection, `staff`, so CMS logins never mix with user logins. See Staff below.

**Sign-up flow** (`/signup`): 1) email entered, a 6-digit code is emailed (`signup.code`/`signup.codeExpiresAt`, 15-minute expiry) — this replaces Payload's own link-based verify email for the public flow, though the link-based one still works for accounts created by other means; 2) the code is confirmed, which sets `_verified: true` and so fires the same `allowedDomains`-matching hook as before; 3) the user sets a password and fills out their profile — if no Access Provider was matched, they can name their company instead, which creates a **Pending**, **None**-plan Access Provider for staff to follow up on; `signup.completedAt` is set, marking the account complete. 4) `/signup/finish` shows the publication-preference picker for an already-subscribed company, or a contact-us notice plus the next upcoming event for one that isn't.

### Staff (Payload auth collection `staff`)

Five employees log in to the CMS. Roles build on each other.

| Role | Who | Can |
|---|---|---|
| Editor | all staff | create, edit, publish and send all content: excerpts, data, guides, publications and issues, events |
| Gatekeeper | 2 staff | everything an editor can, plus manage Users, Access Providers, discount codes, registrations and EmailFlags |
| Admin | Papa | everything, plus manage Staff accounts and site settings (Mailchimp settings, etc.) |

Fields: `name`, `email` (auth), `role` select: editor · gatekeeper · admin.

### AccessProvider (`access-providers`)

A company or organization whose subscription its users inherit. Created and maintained by staff only.

| UI label | Field | Payload type | Req. |
|---|---|---|---|
| Company Name | `name` | text | ✓ |
| Status | `status` | select: Pending · Trial · Live | |
| License Expiry Date | `licenseExpiresAt` | date (UI shortcut: "set to 1 year from today") | |
| *(new)* | `plan` | select: None · Base · Premium (premium includes base); set by staff, including for Trial providers | ✓ |
| Allowed Domain(s) | `allowedDomains` | array of text: domains (*itc.in*) or full addresses | |
| User(s) | `users` | **join** field (reverse of `user.accessProvider`), read-only list | |
| Primary User(s) | dropped | no longer used | |

- Users are stored once, on the User (`accessProvider`), and the provider screen shows them through Payload's `join` field. Today's screen edits the list from the provider side; a join keeps that view without two sources of truth.
- The example (ITC Limited) has a *gmail.com* user and no allowed domains, so users can also be attached by hand. That stays possible by editing the user.
- **Effective access** = status is Trial or Live, and `licenseExpiresAt` is in the future (or empty), and then `plan` decides None / Base / Premium. Pending and expired providers grant nothing. Staff pick the plan for trials (usually Base).
- No separate Subscriptions collection: with manual, unpriced deals, plan + status + expiry on the provider is the whole subscription. If renewal history is ever needed, it can be split out later.

## Events

Source: Papa's notes and the current *New Event* screen (2026-10-08).

### Channels (config in code, not a collection)

Every event belongs to a channel, and events in a channel share brand color, homepage and contact email. These change so rarely that they live in a typed config file, and the event stores only the channel key.

| Key | Name | Format | Notes |
|---|---|---|---|
| `atnf` | ATNF | Hybrid | Annual American conference |
| `gtnf` | GTNF | Hybrid | Annual global conference |
| `infocus` | InFocus | Online (for now) | Webinars |
| *(future)* `nrc` | NRC Workshops | In person | Small events; may end up under InFocus instead |

Each config entry: `name`, `brandColor`, `homepagePath`, `contactEmail`, `format` (in person · online · hybrid). "Event Type" on today's screen is dropped because format comes from the channel.

### Event (`events`)

Only **name, start date and end date are required**; everything else is optional.

| Today's section / label | Field | Payload type | Req. |
|---|---|---|---|
| Event Name (e.g. *GTNF 2023*) | `name` | text | ✓ |
| *(new)* | `channel` | select from the channel config | ✓ (proposed) |
| Start Date + Start Time | `startsAt` | date with time | ✓ |
| End Date | `endDate` | date | ✓ |
| Event Timezone | `timezone` | select (IANA zone, e.g. *Europe/London*) | |
| Replay | `hasReplay` | checkbox | |
| Event Type | dropped | comes from channel | |
| Tagline | `tagline` | text | |
| Event Image | `image` | upload → Media | |
| Event Description | `description` | richText | |
| Location | `venue.address` | text with address autocomplete (+ geo point) | |
| Location Description | `venue.description` | richText | |
| Hotel Contact Number | `accommodation.phone` | text | |
| Hotel Email | `accommodation.email` | email | |
| Booking Affiliate Link | `accommodation.bookingUrl` | text (URL) | |
| Accommodation Description | `accommodation.description` | richText | |
| Event Days | `days` | array: `date`, `name` (e.g. *Registration Day*) | |
| *(new)* | `ticketTypes` | array, see Ticketing | |
| *(new)* | `sponsors` | relationship → Sponsors, hasMany, ordered | |
| *(new)* | `speakers` | relationship → Speakers, hasMany, ordered | |

- **Admin layout:** today's sections (General, Details, Location, Accommodation, Event Days) map to Payload tabs or collapsible groups.
- **Manage this event** (`/admin/events/:id/manage`): a one-screen dashboard, linked from the Event's admin edit screen, since in practice staff only ever run one event at a time and re-picking it on every related screen (sponsors, speakers, sessions, discount codes, registrations) was tedious. From there: attach an existing Sponsor/Speaker or create+attach a new one in place, add a Session (its Day field offers only this event's `days`, not a free date picker), edit `ticketTypes` inline, and (gatekeeper+) create Discount codes and manage Attendees — both scoped to `where: event = this event`. Attendees can be added two ways: an existing User, or a new one (creates the account with a throwaway password and emails them a set-password link, same as the buy-for-colleagues flow); either way it's a $0 "comp" Order + an active EventRegistration, no Stripe involved.
- **Venue** is a plain group on the event, not the excerpt Locations taxonomy, because it's a specific street address. Online events leave it blank.
- **Event Days** today shows one row per date between start and end, with a blank name falling back to a suggested name. In Payload, a `beforeChange` hook fills in the rows from the date range and keeps any names already typed.

### Ticketing

Pricing varies by ticket type, by attendance (in person or virtual), by whether the buyer is a subscriber, and by discount code. Subscribers get no free events, only lower prices.

**Ticket types (`ticketTypes` array on each Event)**

| Field | Type | Example / notes |
|---|---|---|
| `name` | text | *General Admission*, *Public Health*, *Academia* |
| `inPerson.price` / `inPerson.subscriberPrice` | number / number, optional | blank = no in-person option (e.g. InFocus); blank subscriber price = same as non-subscriber price |
| `virtual.price` / `virtual.subscriberPrice` | number / number, optional | every type has its own virtual price |
| `capacity` | number, optional | |

Tickets are always offered for current/upcoming events, subject to capacity and configured attendance options. Both subscriber and non-subscriber prices are advertised publicly. Legacy sale/eligibility fields are hidden and ignored; see [event checkout](./event-checkout.md).

The subscriber price applies when the buyer's access provider has an active Base or Premium plan. Kept as an array on the event, since prices are set per event.

**DiscountCode (`discount-codes`)**

Given to certain companies for 25–100% off a set number of tickets.

| Field | Type | Notes |
|---|---|---|
| `code` | text, unique | ✓ |
| `event` | relationship → Events | ✓ |
| `accessProvider` | relationship → AccessProviders, optional | the company it was given to |
| `percentOff` | number 1–100 | 100 = comped ticket |
| `maxUses` | number | the "given number of tickets"; each ticket uses one |
| `uses` | **join** → EventRegistrations | count = tickets used so far |
| `ticketTypes` | text list, optional | limit the code to certain ticket types |
| `expiresAt` | date, optional | |

### Order (`orders`)

One checkout by one buyer, which can include tickets for colleagues.

| Field | Type | Notes |
|---|---|---|
| `buyer` | relationship → Users | ✓ the person paying |
| `event` | relationship → Events | ✓ |
| `registrations` | **join** → EventRegistrations | the tickets in this order |
| `discountCode` | relationship → DiscountCodes, optional | applied to each ticket in the order, up to its remaining uses |
| `subtotal`, `discount`, `total` | number | |
| `status` | select: pending · paid · cancelled · refunded | today's "Success" = paid |
| `paidAt`, `paymentRef` | date, text | from the payment provider |

### EventRegistration (`event-registrations`)

One ticket for one attendee.

| Field | Type | Notes |
|---|---|---|
| `order` | relationship → Orders | ✓ |
| `event` | relationship → Events | ✓ (copied from the order for easy filtering) |
| `attendee` | relationship → Users | ✓ once the attendee has an account |
| `attendeeName`, `attendeeEmail` | text | entered by the buyer; used to invite a colleague who has no account yet |
| `ticketType` | text (ticket type name, copied at purchase) | ✓ |
| `attendance` | select: in person · virtual | ✓ |
| `priceBasis` | select: standard · subscriber | which price applied |
| `amountPaid` | number | after discount |
| `status` | select: pending · active · cancelled | Checkout tickets become active only after verified payment/free fulfillment |
| `inviteRequired`, `inviteSentAt` | checkbox/date, read-only | New-colleague invitation work and accepted-mail timestamp |

- **Buying for colleagues:** the buyer enters each attendee's name and email. If the email already has an account, the ticket attaches to it; otherwise the attendee gets an invite, and the ticket attaches when they register.
- **Subscriber price** is judged on the buyer's company, which in practice is the attendees' company too.
- A registration gives its attendee access to that event (and its replay, if `hasReplay`), whether or not they have an access provider.
- The user's "Products Purchased" view becomes a join on `attendee`.

### Session (`sessions`): agenda items

One collection for all events' agenda items. Each session has its own Draft/Published state (Payload drafts), as today's "Status: Draft" shows.

| UI label | Field | Payload type | Req. |
|---|---|---|---|
| *(from breadcrumb)* | `event` | relationship → Events | ✓ |
| Title | `title` | text | ✓ |
| Description | `description` | textarea (plain text today; could be richText) | |
| Day | `day` | date, picked from the event's `days` (shows the day name) | ✓ |
| Start Time / End Time | `startTime`, `endTime` | time, in the event's timezone | |
| Session Type | `type` | select: Keynote · Panel · Break · Other | ✓ |
| Location | `room` | text (a room or stage within the venue, e.g. *Main Hall*) | |
| Moderator | `moderators` | relationship → Speakers, hasMany, ordered | |
| Speakers | `speakers` | relationship → Speakers, hasMany, ordered | |
| New custom speaker group | `speakerGroups` | array: `label` (e.g. *Respondents*), `speakers` → Speakers | |
| Sponsor(s) | `sponsors` | relationship → Sponsors, hasMany; choices limited to the event's sponsors | |
| Replay Embed | `replayEmbed` | textarea (embed code or video URL) | |

- On the Event screen, a **join** field lists its sessions, so staff can build the agenda from the event.
- `replayEmbed` is readable only by users registered for the event, and only when the event's `hasReplay` is on.
- **Location** today uses address autocomplete, but within one venue a room name is more useful. *Default chosen: plain text.*

### Livestream attendance (event-level, not per-session)

Live attendance is **one Vimeo livestream embed per event** (`Event.hasLivestream` checkbox + `Event.livestreamUrl` text, updated by staff as needed on each day of a multi-day event) — not a separate video per session. We don't host or stream video ourselves (Vimeo does), and deliberately don't integrate with Vimeo's player SDK for fine-grained playback telemetry — the tradeoff is coarser data (page presence, not confirmed playback), accepted in exchange for staying out of video hosting entirely.

- `Event.livestreamUrl` is field-gated the same way as `replayEmbed`: staff, or a registered attendee, and only once `hasLivestream` is on (`canReadLivestream` in `src/access/eventAccess.ts`).
- `/events/:id/livestream` (gated the same way) renders the embed — Vimeo via `src/lib/replayVideo.ts#detectVideoSource` (tested), parsed from any of `vimeo.com/X`, `vimeo.com/video/X`, or `player.vimeo.com/video/X` — and mounts `LivestreamPresence.tsx`, a client component with no video SDK: it just POSTs to `/api/events/[id]/livestream-ping` every 2 minutes while the tab is open (not gated on visibility — the stream keeps playing, audio included, in a background tab, so visibility would undercount).

### LivestreamPing (`livestream-pings`)

One row per ping — a presence log, not a duration total (contrast with the atomic-counter pattern used elsewhere, e.g. `incrementStat.ts`). Gatekeeper+ read only; never created/updated directly (`access.create/update: () => false`), only via `recordLivestreamPing()` with `overrideAccess: true`. The route re-checks `hasActiveRegistration` itself (a ping isn't a field read, so `canReadLivestream` doesn't apply).

| Field | Payload type | Notes |
|---|---|---|
| `event` | relationship → Events, required | |
| `user` | relationship → Users, required | |
| *(built-in)* | `createdAt` | the ping's timestamp — no separate `occurredAt` field |

Deleting an Event or User while a LivestreamPing references it fails in practice (the FK is `ON DELETE SET NULL`, but the column is `NOT NULL`, so the delete hits the not-null constraint instead — same practical effect as a blocking FK), which is why `livestream-pings` is wiped before both in the seed script.

### Attendee report (`/admin/events/:id/manage`, gatekeeper+)

A section on the existing event-manage dashboard (`AttendeeReportSection.tsx`), built on `src/lib/eventAnalytics.ts`. Since there's no per-session video, "which sessions did they watch" is inferred after the fact by matching each attendee's ping timestamps against the session schedule — not measured directly:

- `combineDayAndTime(day, time)` / `sessionTimeWindow(session)` (pure, tested) — a Session's `day` (date part) and `startTime`/`endTime` (time-of-day part, stored on an otherwise-irrelevant date by Payload's time-only picker) combine into one absolute window. Sessions with no start/end time set can't be matched and are silently skipped.
- `matchPingsToSessions(pingTimestamps, sessions)` (pure, tested) — the core correlation: counts how many of an attendee's pings fall inside each session's window. `pingCount × PING_INTERVAL_MINUTES` (2) estimates minutes present. A ping can match more than one session if their windows overlap.
- `getAttendeeReport(payload, eventId)` — every registration, each virtual attendee enriched with `sessionsAttended` (from the match above) plus `totalPings`/`estimatedTotalMinutes` across the *whole* livestream (some pings may fall outside any session window, e.g. during a break).
- `summarizeAttendeeReport(rows)` (pure, tested) — registration counts (active/cancelled, in-person/virtual), revenue (active registrations only), and the **virtual engagement rate**: the share of active virtual attendees with at least one ping.
- `getSessionPopularity(rows)` (pure, tested) — per-session estimated unique attendees and total/average estimated minutes, ranked by total, derived from the same report (not a separate query).

The UI shows summary stat boxes, a session-popularity table, and an attendee table with an expandable (`<details>`, no client JS) per-session breakdown for virtual attendees — plus a CSV export (`GET /api/admin/events/[id]/attendee-report/export`, gatekeeper+, via `papaparse` — already a dependency).

### Speaker (`speakers`)

Shared across events and used for both moderators and speakers.

| UI label | Field | Payload type | Req. today |
|---|---|---|---|
| Name | `name` | text | ✓ |
| Role | `role` | text (job title) | ✓ |
| Company | `company` | text | ✓ |
| Headshot | `headshot` | upload → Media (png/jpeg) | ✓ |
| Description | `bio` | textarea/richText | ✓ |
| External Links | dropped | not used | |
| *(new)* | `events` | **join** → Events (reverse of each event's `speakers` field) | |

- Agendas always show a speaker's **current** role and company, including on past events (decided, to keep it simple).
- Only `name` really needs to be required; making headshot and bio optional lets staff add a late speaker quickly.

### Sponsor (`sponsors`)

One shared pool, kept separately and assigned to events, since the same sponsors recur across events in every channel.

| UI label | Field | Payload type | Req. today |
|---|---|---|---|
| Company | `name` | text | ✓ |
| Logo | `logo` | upload → Media (PDF, PNG, SVG, JPG) | |
| Description | `description` | richText | ✓ |
| External Links | `website` | text (URL), optional | |

- An Event lists its sponsors (`event.sponsors`); a Session can feature some of them, picked only from that event's list.
- The Sponsor screen shows the events it sponsored through a **join** field.
- No sponsor levels (Platinum, Gold, etc.): all sponsors of an event display the same way.
- External Links becomes a single optional website link. *Default chosen; easy to drop if unused.*

## Data

Source: Papa's notes and current *Data* screens (2026-10-08). Premium-only content (see Access).

Data is a set of **flat tables staff define themselves**: define the columns, upload a spreadsheet, map spreadsheet columns to the defined columns, and the site shows it as a sortable, filterable grid (AG Grid today, kept). Current datasets (12): International Import Tariff, International Tax Rates, USA State Tax on Cigarettes and Other Tobacco Products, International Production and Consumption of Tobacco Leaf, Cigarette Market Share by Brand, Cigarette Market Share by Company, International Production and Consumption of Cigarettes, Forecast of International Production and Consumption of Cigarettes, International Smoking Demographic Information, US Imports, US Exports, USA Cigarette Brands. (*Public Policy Updates* and *USA Product Trademarks* appear under Data on the current site but are dropped here.)

```
 Dataset 1 ──── * DatasetRow          (row values stored as JSON)
    │ columns[]                        country-type cells ──► Country (reference)
    └ imports[] ──► Media (uploaded spreadsheet)
```

### Dataset (`datasets`)

| UI label | Field | Payload type | Req. |
|---|---|---|---|
| Title | `title` | text | ✓ |
| *(card subtitle)* | `description` | textarea | |
| *(nav/page grouping)* | `category` | select: Policy · Markets · Trade | ✓ |
| *(card icon)* | `icon` | select or upload | |
| *(URL)* | `slug` | text, unique | ✓ |
| Data Headers | `columns` | array, sortable (order = grid column order), see below | ✓ |
| Data Mapping | `lastImport` | group: `file` → Media, `mapping` (spreadsheet header → column key), `importedAt`, `rowCount` | |

**Column definition (`columns` row)**

| Field | Type | Notes |
|---|---|---|
| `label` | text | *Country*, *Import Duty*, *Ad Valorem (% of customs import value)* |
| `key` | text, stable | generated from the label once; rows store values under this key so renaming a label never breaks data |
| `type` | select: text · number · percent · year · date · country · link | drives grid formatting and filter type |
| `filterable`, `sortable` | checkbox | default on |
| `defaultSort` | select: none · asc · desc | optional |

"Data Points" on today's screen is the count of non-empty cells per column; computed, not stored.

### DatasetRow (`dataset-rows`)

| Field | Type | Notes |
|---|---|---|
| `dataset` | relationship → Datasets, indexed | ✓ |
| `values` | json (Postgres `jsonb`, indexed) | `{ "country": "AT", "year": 2016, "company": "British American Tobacco", "marketShare": 5.9 }` |

- One shared rows table with JSON values, **not** a real Postgres table per dataset. Staff can add or change columns without migrations, and dataset sizes (a few thousand rows, e.g. 3,559) are small for `jsonb`.
- **Import** is a custom admin view on the Dataset (upload → map headers → preview → confirm). It bulk-inserts rows directly through Payload's database adapter, since creating thousands of rows one by one through the normal API is slow. A **Replace existing rows** toggle (on by default) decides whether the import replaces the dataset or appends to it; staff normally keep the master spreadsheet offline and replace.
- Rows are hidden from the admin sidebar; staff manage them only through import.
- **Front end:** AG Grid loads a dataset's rows from one API route (client-side sorting and filtering is fine at these sizes). The route checks the user's plan is Premium.
- **Download:** premium users can download a dataset as CSV/Excel, generated from the rows (respecting current filters is a nice-to-have).

### Country (`countries`): reference

The one non-flat piece: a reference list that country-type cells point to, so the grid can show flags and names consistently.

| Field | Type |
|---|---|
| `name` | text, e.g. *Austria* |
| `iso2`, `iso3` | text, unique |
| `flag` | derived from `iso2` (emoji or icon set), not stored |
| `aliases` | text list, e.g. *USA*, *United States of America*; used to match spreadsheet values on import |

On import, country cells are matched by name, alias or ISO code and stored as the ISO code; unmatched values are listed in the preview for staff to fix.

## Guides

Source: Papa's notes (2026-10-08), with later access corrections below. Guides require Premium by default; individual guides may permit Base access via `requiresPremium: false`.

Known guides, listed in the main nav's Guides dropdown: US Tax Guide, Int'l Tax & Tariff Guide, FDA Regulation, EU-TPD, FCTC.

### Guide (`guides`)

| Field | Payload type | Req. |
|---|---|---|
| `title` | text | ✓ |
| `description` | textarea | |
| `thumbnail` | upload → Media (public image) | |
| `file` | upload → GuideFiles (PDF) | ✓ |
| `slug` | text, unique | ✓ |
| `requiresPremium` | checkbox, default `true` | |
| `publishedAt` / `_status` | Payload drafts | |

- **GuideFiles** is a separate upload collection holding only the PDFs, with read access limited to subscribers. Files are served through Payload's access-checked file route, never a public storage URL, so a shared link doesn't leak the PDF.
- Thumbnails stay in the public Media collection so the guide list can show them to everyone.
- **Access is per-guide, not collection-wide**: most guides require Premium; `requiresPremium: false` opts a specific guide into Base access too (`canReadGuide` in `src/access/guidesAccess.ts`, returns a `Where` clause for Base subscribers so the list query and the document read are scoped identically — same pattern as `EventRegistrations.readOwnOrManaged`). This corrects an earlier, wrong assumption (both the original brief and the code had Guides as a blanket "Base or Premium" collection) — in the real business rules, Base gets Publications but not Data or Guides, with a handful of named guide exceptions.

## Publications

Source: Papa's notes and Mailchimp screenshots (2026-10-08), updated for live SES on October 15. Newsletters are readable by Base/Premium subscribers. SES is the default sender; Mailchimp is historical only. A **Publication** is the newsletter; an **Issue** is one edition. Live SES delivery uses the Payload queue, signed unsubscribe and verified SNS feedback, separately from account email. See [newsletter delivery](./newsletter-delivery.md) and [the current checklist](./project-status.md).

Known publications: Daily Executive Summary, Weekly Executive Summary, Global News Clippings (by region and subject), US News Clippings, Vapor News Clippings, Monthly Research Digest, Daily US Legislative Snapshot, Weekly US Legislative Report, Weekly US Trademark Report, Monthly US Trademark Activity, and US Tobacco Trade Barometer. The broader old *Economics* section and *FDA Watch* were excluded from the prototype; the Trade Barometer was subsequently added as its own publication.

```
 Publication 1 ──── * Issue ──┬─ excerpt list ──► Articles / Bills / Trademarks
  (rules, Mailchimp ids)      ├─ PDF report   ──► protected PDF file
        ▲                     └─ custom HTML
        │ * subscribed by *
       User ──── sync ────► Mailchimp audience (Publications interest group)
```

### Publication (`publications`): the newsletter itself

| Field | Payload type | Notes |
|---|---|---|
| `title` | text, required | e.g. *US News Clippings* |
| `category` | select, hasMany, required: News · Legislation · Trademarks | which tracking categories this publication draws from (e.g. an executive summary can be News + Legislation + Trademarks at once); groups it in the main nav's Publications dropdown and on the Publications page |
| `slug` | text, unique | |
| `description` | textarea | e.g. *A weekly summary of key US industry news* |
| `thumbnail` | upload → Media | |
| `format` | select: Excerpt list · PDF report · Custom HTML | each issue copies it as its default |
| `frequency` | select: daily · weekly · monthly | sets the default date window |
| `selectionRules` | group, excerpt-list only (below) | |
| `groupingRules` | group, excerpt-list only (below) | |
| `generator` | select: Manual · Weekly US Trademark Report · Monthly US Trademark Activity · US Tobacco Trade Barometer | Automated trademark and monthly trade publications use their corresponding generators |
| `mailchimp.interestId` | text | the publication's checkbox in the audience's *Publications* interest group |
| `mailchimp.segmentId` | text | the saved segment ("Publications one of …") used when sending |
| `header` | code (HTML) | rendered before the tracking content / PDF download link in every issue, email and web. Trusted HTML (editor-role+), not sanitized |
| `footer` | code (HTML) | rendered after the tracking content / PDF download link |

**Selection rules** (defaults for building an issue; editors adjust each issue):

| Field | Type | Example: US News Clippings | Example: Vapor News Clippings |
|---|---|---|---|
| `window` | number of days back (defaults from `frequency`) | 7 | 7 |
| `excerptTypes` | multi-select: Articles · Bills · Trademarks | Articles | Articles |
| `locations.include` / `.exclude` | relationship → Locations | United States | (any) |
| `products.include` / `.exclude` | relationship → Products | (any) | Vape, E-liquid |
| `sectors`, `subjects` include / exclude | relationship | | |

A location rule matches the place and everything inside it (*United States* matches *Pennsylvania, USA*), so Locations needs a parent hierarchy (see Taxonomy collections).

**Grouping rules**

| Field | Type | Example |
|---|---|---|
| `groupBy` | select: none · region · country · primary subject · sector · product · excerpt type | Excerpt lists: continent (stored as region); US News Clippings: primary subject |
| `thenGroupBy` | same options, optional | Global News Clippings: primary subject |
| `sortBy` | select: source date (newest first) · source date (oldest first) · title | |

### Issue (`publication-issues`)

| Field | Payload type | Req. |
|---|---|---|
| `publication` | relationship → Publications | ✓ |
| `title` | text, defaults to "*Publication* - *date*" | ✓ |
| `issueDate` | date | ✓ |
| `format` | select, defaults from the publication | ✓ |
| `_status` | Payload drafts | |

**Excerpt list**: a **Build from rules** button runs the publication's selection rules over the date window, groups and sorts the results, and fills `sections`. Editors then remove, add or reorder items before publishing.

| Field | Type | Notes |
|---|---|---|
| `intro` | richText, optional | |
| `sections` | array, sortable | one group each; continent > primary subject is stored as *Europe: Regulation* and rendered as a continent heading followed by subject subheadings in email, preview and web editions. US News Clippings uses subject headings only. |
| `sections.heading` | text | |
| `sections.items` | relationship → Articles, Bills, Trademarks (polymorphic), hasMany, ordered | |

Rule builds include each excerpt record once. Migrated articles with different IDs are also selected once when the normalized title, HTTP(S) source URL and full rich-text excerpt agree. A changed excerpt or different source URL remains a separate selection; missing URLs/excerpts are not inferred to be duplicates. This operates after geographic eligibility and does not delete or merge CMS records. Beta inspection on October 17 confirmed the reported drought story had two records and the vape-shop story four, with identical excerpts and source URLs in each set. Draft issue 3254 was backed up and repaired from 44 selections to 17, preserving section order and all underlying articles. A read-only check of the deployed builder returned the same 17 selections on two consecutive builds.

**PDF report**: `summary` (richText), `file` (upload → protected PDF collection, same approach as GuideFiles).

**Custom HTML**: `body` as a code field holding sanitized HTML, since these are designed outside the CMS. No header/footer or ads — fully custom, designed outside the CMS.

### PublicationAd (`publication-ads`)

Image ads sold per publication. Managed from its own admin nav entry under Guides & Publications ("Publication Ads").

| Field | Payload type | Req. | Notes |
|---|---|---|---|
| `advertiser` | text | ✓ | internal label, not shown to users |
| `publication` | relationship → Publications | ✓ | ads are sold per-publication, not globally |
| `image` | upload → Media | ✓ | |
| `link` | text (URL) | ✓ | must be a full `http(s)` URL (field-level `validate`) |
| `rank` | number | ✓ | lower rank fills the earlier slot |
| `startDate`, `endDate` | date | ✓ | campaign window; `endDate` must be ≥ `startDate` (field-level `validate`, pure logic in `src/lib/publicationAds.ts#isValidAdWindow`, tested) |
| `stats.impressions` | number, readOnly | | incremented by 1 per issue **send** this ad was placed in — not a user-level open count. See the caveat below |
| `stats.clicks` | number, readOnly | | incremented atomically (same pattern as `incrementStat.ts`) whenever `/api/ads/[id]/click` is hit |

**Placement**: for an excerpt-list issue, ads rotate into the slot before story 1, then every 2 stories after (before 1, 3, 5…), counting items across the *whole issue*, not restarted per section — if a slot lands on the first item of a new section, the ad renders right after that section's heading. The number of slots an issue has is `ceil(itemCount / 2)` (`adSlotCount`), and whichever ranked, currently-active ads exist for the publication (`getActiveAdsForPublication`, sorted by `rank`) fill those slots low-rank-first. A PDF-report issue has no "story" list to interleave with, so instead it shows all active ads (ranked, capped at 5 slots) in one block right before the download link. This placement logic (`adSlotCount`, `isAdSlotBeforeIndex`, `isValidAdWindow`) lives in `src/lib/publicationAds.ts` and is shared by both renderers below.

**Rendering**: both the email template (`src/lib/issueEmail.ts`) and the web issue page (`src/app/(frontend)/publications/[slug]/issues/[id]/page.tsx`) independently interleave the same ad list using the same shared placement functions — one renders an HTML string, the other JSX, so the markup-building code itself isn't shared, only the placement decision. An ad renders as a linked image; the link always points at `/api/ads/[id]/click` (public, no auth) rather than straight at the advertiser, so we can count the click ourselves before redirecting — this doesn't depend on Mailchimp's or SES's own click tracking, consistent with "our site is the source of truth."

**Impressions caveat**: Mailchimp doesn't give us a per-recipient delivery count the way SES's `sendBulk` does (see "Delivery stats" below — Mailchimp's own stats sync isn't built yet either), so rather than have ad impressions mean something different per provider, an "impression" here just means *this ad was included in one issue send*, counted the same way for both. It's a coarser signal than true user-level views, but it's honest and available today. Test sends don't count.

### Trademark reports (automated PDF publications)

Two publications are generated, not hand-built. Both use the **PDF report** format.

| Publication | Contents | Schedule |
|---|---|---|
| Weekly US Trademark Report | New trademarks **published for opposition** in the past week | every week |
| Monthly US Trademark Activity | **Published marks, cancellations and renewals** in the previous calendar month (requires every weekly Gazette import); too large to read in an email, so it's a PDF only | first week of each month |

**Weekly job** (`src/jobs/tmogImportTask.ts`, Payload's job-queue cron — `schedule: [{ cron: '0 12 * * 5', queue: 'tmog-import' }]`, ticked by `jobs.autoRun` in `payload.config.ts`; Fridays ~12:00 UTC, six hours after the Gazette's own ~06:00 UTC posting time):

1. **Resolve the issue**: the coming Tuesday (YYYYMMDD); if that return 404 (not posted yet), step back a week at a time, up to 4 weeks. Before fetching each candidate, check TrademarkImportRuns for an already-succeeded run on that date and skip it — idempotent and safe to re-run (`src/lib/tmog/fetchIssue.ts`, `src/lib/tmog/importJob.ts`).
2. **Stream-parse** `https://cdn.uspto.gov/doc/TMOGIssue_YYYYMMDD_entire?extension=xml` (~200MB, one line, ~23,000 records) with `saxes`, never buffering the whole file or building a DOM (`src/lib/tmog/parseIssue.ts`). Keep only records with a `tmk:ClassNumber` of 34.
3. **Classify by TMOG section**, not `MarkCurrentStatusCode` (`src/lib/tmog/classify.ts`):
   - "Applications publishing for opposition" → Published → `publishedDate`
   - "Registrations publishing" → Registered → `registeredDate` (+ `registrationNumber`, a direct child of the record)
   - "Registrations no longer in effect" **and** status code 709–713 → Cancelled → `cancelledDate` (the same section also carries Section 16A/16B removals under other codes — excluded)
   - "Registrations renewed" → Renewed → `renewedDate` (+ updates `owner`/`renewal.owner`, since ownership can transfer)
   - anything else (e.g. "New Certificate", "Correction of errors on registrations") → dropped
4. **Upsert** each kept record into `trademarks` by `serialNumber`.
5. **Fetch each kept record's image** from `https://cdn.uspto.gov/img/<serial>/<issueDate>/original` when `com:ImageFileName` was present, throttled to ~5 req/s with up to 3 retries (`src/lib/tmog/images.ts`). A 404 or exhausted retries just leaves `image` blank — never fails the run.
6. Build the weekly PDF from trademarks whose `publishedDate` falls in the past week; in the first week of the month, also build the monthly PDF from trademarks whose `publishedDate`, `cancelledDate`, or `renewedDate` falls in the previous month, after verifying successful official imports for every Tuesday Gazette issue in that month (`src/lib/trademarkReportIssues.ts`, shared with the fixture job below). Each becomes a **draft Issue** with the PDF as `file` and a short generated `summary`.
7. Record the run in TrademarkImportRuns (counts by status, images saved/missing, issue date, any error).

Staff review each draft, publish it, then press Send as usual. The email carries the summary and a download link, not the report itself. These PDFs now use the branded trademark renderer (`src/lib/tmog/reportPdf.tsx`) with mark details, available artwork, USPTO links, and running page headers/footers. Weekly bounds use the Gazette issue date; monthly bounds use the previous complete calendar month. See [Trademark report PDFs](trademark-reports.md) for generation, regeneration, and testing.

A manual run is available at `/admin/trademark-reports` (gatekeeper+) — "Run live USPTO import" (optionally for one specific `YYYYMMDD`, bypassing the idempotency skip) and "Run with fixture data" (offline, `docs/sample-data/uspto-fixture.json`, for testing without network access). Both call the same `buildTrademarkReportIssues` for the report-drafting step. The separate "Generate a report" form creates a fresh weekly or monthly PDF draft from existing CMS records, without a Gazette re-import.

### TrademarkImportRun (`trademark-import-runs`)

A log of each pull (scheduled or manual), so failures are visible and re-runs can skip what already succeeded.

| Field | Type | Notes |
|---|---|---|
| `issueDate` | date | the TMOG issue (always a Tuesday) this run processed; used to skip already-succeeded issues |
| `startedAt`, `finishedAt` | date | |
| `status` | select: running · succeeded · failed | |
| `feedSource` | text | the feed URL used, or `fixture:<filename>` for the offline job |
| `counts` | group: `new`, `updated`, `published`, `registered`, `renewals`, `cancellations`, `imagesSaved`, `imagesMissing` | |
| `issuesCreated` | relationship → Publication Issues, hasMany | |
| `error` | textarea | |

### US Tobacco Trade Barometer (automated PDF publication)

Monthly, upload-triggered rather than scheduled: any **editor** uploads the two files US Census emails each month (`Imp_MMYYYY.xls`, `Exp_MMYYYY.xls`) at `/admin/trade-reports`, and the site does the rest. Ports a previously-standalone, independently-validated proof of concept (`ttb-trade/`, not part of this app's build — see its own README) rather than being built from scratch; its loader/normalizer/report logic was checked line-by-line against the real published April 2024 report before the port.

**Where the trade data lives**: three new Postgres schemas (`ref`, `trade`, `report`) in the same database Payload already uses, namespaced so Payload's own schema-push never touches them. `ref` holds HTS/country/district/rate-provision reference codes; `trade` holds one fact row per Census record (`import_fact`/`export_fact`, keyed by year/month/HTS/country/...); `report` holds the published layout (which HTS codes roll into which report line, by chapter). Raw SQL against these goes through `payload.db.pool` (`src/lib/ttb/db.ts`), the same pattern as other raw-SQL migration scripts in this codebase.

**Upload flow** (`src/components/TradeImportWizard.tsx`, mirrors the dataset `ImportWizard`'s preview → confirm shape):

1. **Preview** (`/api/trade-reports/import-preview`): runs the real loader (`loadMonthlyFile`) inside a transaction that's always rolled back (`src/lib/ttb/preview.ts`), so the editor sees the detected year/month, row count, any "this month already has N rows — replace?" warning, and the YTD sanity check (this month's cumulative total vs. last month's cumulative + this month, flagged if they differ by more than 2%) before anything is written.
2. **Confirm** (`/api/trade-reports/import-confirm` → `src/lib/ttb/tradeReportJob.ts`): loads each file in its own transaction (one failing doesn't affect the other), adding any new HTS/country/district code it encounters to the reference tables automatically.
3. **Dataset refresh** (`src/lib/ttb/syncDatasets.ts`): recomputes that year's annual (commodity, country) totals — on the same reporting basis as the published report (imports: consumption figures; exports: domestic only) — and replaces that year's rows in the existing **US Imports**/**US Exports** Datasets. Country names resolve to nic360's canonical iso2 through the same lookup the generic CSV importer uses (`buildCountryLookup`/`normalize`, exported from `src/lib/datasetImport.ts` for this reuse).
4. **Report generation**: builds the six-chapter Trade Barometer for the most recently loaded month using the ported chapters/data/format/text/chart layer, with explicit numeric conversion at the app's database boundary. It renders a real PDF (`src/lib/ttb/report/pdf.tsx`, `@react-pdf/renderer`; trademark reports also have a real renderer as of October 15), then drafts a `publication-issues` record (format `pdf-report`, `_status: draft`) against a **US Tobacco Trade Barometer** publication (`generator: monthly-trade-barometer`). Figures the database can't supply (total US trade from Census FT-900, TRQ usage, editorial commentary) come from optional inputs JSON in the upload form; missing figures render as highlighted editorial placeholders.
5. Every run is logged to **TradeImportRun** below.

**Rendering:** the full report has roughly 162 tables, 3,000 rows, and 10 charts. Rendering runs synchronously and takes tens of seconds. The PDF uses the installed renderer's opt-in measured pagination engine: each table's title and column headers repeat at physical page breaks, scoped to that table, while individual body rows stay together. The existing `public/logo.png` supplies the cover and running-header branding. See the runbook for visual verification and upgrade-sensitive regression tests.

**Railway beta database setup completed October 14, 2026**: `ref`/`trade`/`report` history through August 2026, Payload trade-import log tables, the generator enum value, and one monthly publication are present. Both existing datasets have the required column types. See `docs/ttb-trade-report.md` for verified counts, source gaps, backup details, and the successful beta deployment and remaining signed-in staff-flow checks. The first-time restore guard now refuses this initialized target; do not run the prototype's `DROP SCHEMA ... CASCADE` script against it.

**Numeric boundary**: pg returns aggregate NUMERIC values as strings by default. `src/lib/ttb/numeric.ts` explicitly converts and validates report and dataset measures without altering Payload's global parsers. The first port omitted the prototype's numeric parsers, causing concatenated totals and overlapping PDF digits; width changes alone did not resolve it. Offline regression tests and opt-in read-only local integration tests cover the repair.

### TradeImportRun (`trade-import-runs`)

A log of each monthly upload, mirroring TrademarkImportRun's shape. Access is gated at `editor` for read/create/update (not `gatekeeper` like TrademarkImportRun), since any editor can trigger this job.

| Field | Type | Notes |
|---|---|---|
| `startedAt`, `finishedAt` | date | |
| `status` | select: running · succeeded · failed | |
| `files` | group: `import`, `export` (text) | the uploaded filenames |
| `counts` | group: `importRows`, `exportRows`, `importReplaced`, `exportReplaced`, `newHtsCodes`, `newCountries` | |
| `dataQualityNotes` | array of text | duplicate/overlap warnings, the YTD check result, and reference-code additions the loader surfaced |
| `issuesCreated` | relationship → Publication Issues, hasMany | |
| `error` | textarea | |

### Email preferences and historical Mailchimp sync

Current delivery uses the CMS preferences directly through SES, with an eligibility/suppression check immediately before each message. The following Mailchimp audience design is retained only as prototype history; no live mirror, nightly reconciliation or Mailchimp webhook is required for SES. The old expiry/reconciliation description below was a design, not implemented automation. Current unsubscribe and recovery behavior is in [newsletter delivery](./newsletter-delivery.md).

Our site is the **source of truth**; Mailchimp only mirrors it. This section describes the `EMAIL_PROVIDER=mailchimp` path specifically — the standing, continuously-synced audience state it depends on. The `ses` path doesn't need any of this: it computes who should receive an issue fresh from our own data at send time (see "Sending an issue" above), so there's no persisted audience to keep correct and no sync hook to fire.

| Where | Field | Notes |
|---|---|---|
| User | `emailPublications` | relationship → Publications, hasMany; checkboxes on the user's account page |
| Global `mailchimp-settings` | `audienceId`, `publicationsInterestCategoryId` | one audience (*Nicotine360 Publications*), one interest category (*Publications*); API key stays in env |

- **Who can choose:** any user whose access provider has an active Base or Premium plan. Others see no checkboxes, and their choices are treated as empty.
- **Sync rules:** whenever a user's choices, email, name or eligibility changes, a hook upserts the Mailchimp member with every publication interest set to true or false to match our side, so Mailchimp always ends up identical to the site. Eligibility changes include a provider expiring, a plan dropping to None, or a user leaving their provider.
- **Expiry:** a nightly job re-syncs users whose provider expired that day (expiry has no save event to hook on) and does a full reconciliation to fix any drift.
- **No outside sign-ups:** Mailchimp sign-up forms are turned off; changes made in Mailchimp are overwritten on the next sync.
- **Unsubscribes are the one exception.** A Mailchimp webhook (unsubscribe, spam complaint, or address cleaned after bounces) clears that user's `emailPublications` on our side and opens an **EmailFlag** for follow-up, since nearly every case is a mistake or an overzealous firewall. The follow-up process is defined later (likely notifying the relationship manager).
- **Re-subscribing**: staff confirm the user wants to resume and review any delivery problem (including independent AWS suppression), then press **Re-add**. It restores `publicationsBefore` and resolves the flag transactionally. Mailchimp contact deletion is no longer part of the SES workflow.

### EmailFlag (`email-flags`)

A staff queue of unsubscribes and delivery problems to follow up on.

The user link becomes null when a user is deleted; `recipientEmail` retains the delivery address and unresolved flags still suppress it. New flags require a user. Deleted-user flags remain editable for follow-up, but cannot use Re-add. See [migration exception review](./migration-exceptions.md) for the completed schema repair, subscription assignment audit and approved company decisions.

| Field | Type | Notes |
|---|---|---|
| `user` | relationship → Users | Required on creation; nullable after account deletion so the flag survives |
| `recipientEmail` | email, read-only | Snapshotted from the user; retained for follow-up and suppression after deletion |
| `reason` | select: unsubscribed · spam complaint · cleaned (bounces) | from the webhook |
| `occurredAt` | date | |
| `publicationsBefore` | relationship → Publications, hasMany | what they were receiving, so it can be restored |
| `status` | select: open · following up · resolved | |
| `notes` | textarea | |
| *(action)* | **Re-add** button | restores prior choices after consent/delivery review, then resolves the flag atomically |

### Sending an issue

The CMS queues delivery when a staff member presses **Send** on a published issue (with confirmation). SES is the default; `EMAIL_PROVIDER=mailchimp` explicitly selects the legacy prototype, whose live sender is not implemented or needed. Beta safe mode blocks audience sends. **Preview issue** in the creation/edit form renders unsaved data without writing, sending or recording ad metrics; desktop/mobile email and an attached PDF are available. **Send test** uses the saved issue, so save edits before emailing a test.

| Issue field | Type | Notes |
|---|---|---|
| `email.subject` | text | defaults to the issue title |
| `email.previewText` | text | |
| `email.provider` | select: mailchimp · ses, read-only | which sender actually sent this issue |
| `email.campaignId` | text, read-only | Mailchimp campaign id, or a generated SES send-batch ref |
| `email.status` | select: not sent · sending · sent · failed, read-only | |
| `email.sentAt`, `email.sentBy` | date, relationship → Staff, read-only | |
| `email.sendHtml`, `sendSubject`, `sendAdIds` | hidden text/text/JSON, staff-readable | Frozen content and ad selection for safe retries |
| `email.targetCount`, `lastError` | number/text, read-only | Frozen eligible audience count and delivery/recovery result |
| `email.adsRecorded` | hidden checkbox, staff-readable | Guards ad impressions across retries |

- **Mailchimp path** (`src/app/api/publication-issues/[id]/send/route.ts`'s `sendViaMailchimp`): renders the issue into the email template for its format, creates a campaign targeted at the publication's `mailchimp.segmentId`, sets the content and sends it. A **Send test** button sends to a given address first.
- **SES path** (`sendViaSes`): the default provider, with active/verified/opted-in/plan-eligible/unsuppressed recipients computed from the CMS. Live sends require a published issue, atomically snapshot content/audience and enqueue `send-newsletter` on the `newsletters` queue. A per-issue worker lock, per-recipient delivery log and acceptance callback prevent duplicate sends on concurrency/retry. The worker rechecks eligibility before every message. Simulations only log previews and leave the issue unsent. See [newsletter delivery](./newsletter-delivery.md) for schema preparation, recovery, safety and AWS setup.
- After sending, the issue is locked against re-sending; editing its web version stays possible.

### Delivery stats and the Publications analytics tab

Added when the question "what's the click rate on the last 10 Daily Executive Summaries" turned out to be hard to answer from Mailchimp's own reporting (a recurring publication isn't a first-class thing there — just a string to pattern-match in campaign names). Since `Publication` → `PublicationIssue` already is a first-class relationship on our side, the fix is to store engagement counts on the Issue itself, regardless of which provider sent it.

| Issue field (`stats` group) | Type | Notes |
|---|---|---|
| `recipientCount` | number | set at send time |
| `delivered`, `opens`, `clicks`, `bounces`, `complaints` | number | distinct notification events; SNS retries are deduplicated, multiple opens/clicks still count |

These are issue-level metrics, not independent editable-version data. `preserveIssueStats` locks and carries the authoritative issue counters into every version save; atomic webhook increments and recipient-count updates also synchronize the latest version. Queueing, finalizing a send and editing an issue cannot overwrite counters from concurrent events.

All read-only. Verified SES events populate current delivery statistics; imported historical statistics are retained. A Mailchimp Reports API poller is not required.

**SES client** (`src/lib/ses/`, mirrors `src/lib/mailchimp/`'s simulated/live split, chosen by env `SES_MODE`):

- `types.ts` / `parseEvents.ts`: `parseSesEvent()` is a pure function that normalizes one SES Configuration Set event (Bounce/Complaint/Delivery/Open/Click) into `{ type, emails, issueId, occurredAt }`. `issueId` comes from a message tag (`mail.tags.issueId`) set at send time — each bulk send tags every message with the Issue's id so events can be attributed back to it. Thoroughly unit-tested against realistic SES event JSON shapes.
- `simulated.ts`: writes each bulk send to the new `ses-outbox` collection (full rendered HTML, recipient count) instead of calling AWS — same reviewing-before-a-real-account philosophy as `mailchimp-outbox`.
- `live.ts`: real `@aws-sdk/client-ses` SendRawEmail calls with private MIME envelopes, readable plain text, signed unsubscribe footer and one-click headers, configuration-set attribution, test isolation and no blind SDK retries.
- **Webhook** (`/api/ses/webhook`): hosted requests always require the configured topic and SNS signature. Confirmation URLs are constrained to the signed AWS topic/region/token. `processSesEvent` commits its receipt, preference/suppression changes, acceptance reconciliation and counters together. Notification retries are deduplicated; failed transactions can be retried safely. Test-tagged messages are logged without mutating audience preferences or issue statistics.
- **Suppression** (`src/lib/suppressionList.ts`): open and following-up EmailFlags suppress retained and current addresses, even after user deletion. All pages are read. Signed unsubscribe POSTs clear preferences and open a flag transactionally; GET only confirms. Account-level AWS suppression remains independent.

**NewsletterDelivery (`newsletter-deliveries`)**: staff-readable immutable send log with unique `deliveryKey` (issue/address), nullable `issue`/`user`, `recipientEmail`, `status` (queued/sending/sent/failed/unknown/skipped), `providerMessageId` and `lastError`. Sent means accepted by SES; delivery events prove the receiving mail server accepted it. Unknown outcomes are never resent automatically.

**SesEvent (`ses-events`)**: admin-readable immutable receipt log with unique `eventKey`, `kind`, `messageId` and `isTest`. Its unique key and transactional lock prevent SNS redelivery from repeating mutations or counters.

**`/admin/analytics`'s Publications tab** (`src/lib/publicationAnalytics.ts`): search sent issues by publication, date range and/or a title keyword; see each matched issue's recipients/opens/clicks/bounces/complaints and computed open/click rate, plus totals and averages across the whole matched set. The average rate is the mean of each issue's *own* rate (issues with zero recipients excluded, not counted as 0%) — summed opens over summed recipients would let one huge issue dominate the average, which isn't what "average click rate across these issues" should mean.

## Services

Event checkout's current payment/reservation/invitation behavior and verification status are documented in [event-checkout.md](./event-checkout.md). It supersedes the prototype checkout shortcuts: pending tickets grant no access, fulfillment is transactional/idempotent, cents match exactly, and colleague invitations use a persistent retryable queue. Beta test-key provisioning and actual card/webhook tests remain pending until recorded in that runbook.

| Need | Service |
|---|---|
| Hosting + database | Railway (Next.js + Payload app, Postgres) |
| File storage | S3-compatible bucket (existing AWS S3, or Cloudflare R2 if cheaper) via Payload's storage adapter |
| Payments (event tickets) | Stripe (already in use) |
| Account email (verification, password reset, invites) | AWS SES (same credentials/system as the publication-issue sender below) |
| Newsletters | Live queued SES by default, with signed unsubscribe and SNS feedback; simulations remain available. Account email uses a separate transport. Mailchimp is historical only. |

## Search

Postgres full-text search (`to_tsvector`/`plainto_tsquery`/`ts_rank`), not the Payload search plugin named as the earlier default — chosen for real relevance ranking and stemming (a search for "regulation" matches "Regulate" too) at no added infrastructure cost, since Postgres is already the database. `src/lib/fullTextSearch.ts`'s `searchColumnsForIds()` runs the raw SQL (via `payload.db.pool`, the `pg.Pool` the Postgres adapter exposes) against a fixed, hardcoded table/column allowlist — never request input — and returns ranked ids; `sortByIdOrder()` then re-sorts Payload's own `find()` results (which can enforce access control and combine with other filters, but can't express `ts_rank`) to match that relevance order. No persisted/indexed `tsvector` column or migration — it rescans the table per search, which is fine at this project's scale (dozens to low hundreds of rows per collection) and was verified directly against the real database, including the stemming behavior above.

Articles and Bills get a hidden `searchText` field (`access.read: () => false`, invisible in the admin), populated by a `beforeChange` hook (`src/hooks/buildSearchText.ts`) that strips their richText fields (`excerpt`; `abstract` + `fullText`) to plain text via `lexicalToPlainText()` (`src/lib/lexical.ts`) — raw SQL can't parse Lexical JSON, so this gives it something simple to query. Trademarks needs no such field: `title`, `owner` and `goods` are already plain text.

Front-end filter bars (`ExcerptFilterBar` for Articles/Bills, `TrademarkFilterBar` for Trademarks — both plain `<form method="GET">`s) now include:

- **Keyword** — the full-text search above.
- **Date range** (`dateFrom`/`dateTo`). Articles filters on `sourceDate`, Bills on `billDate`. Trademarks has no single canonical date (which one is set depends on its status — see the TMOG import above), so its date range matches *any* of `publishedDate`/`filedDate`/`registeredDate`/`cancelledDate`/`renewedDate` falling in range.
- Articles and Bills keep their existing sector/product/subject/location filters; Trademarks only gets keyword + date range, since it carries no index-term fields.

`src/lib/excerptFilters.ts` (`excerptWhere`, now parameterized by which date field to use) and the new `src/lib/trademarkFilters.ts` build the Payload `where` clause for everything except keyword; keyword is layered on by each page as a separate `id: { in: [...] }` clause combined with the rest via `and`.

## Analytics

First-party only — no Google Analytics or other third-party script, since every page here is already behind a login and sending that traffic data to an outside service didn't seem like the right call. Instead:

### PageView (`page-views`)

| Field | Type | Notes |
|---|---|---|
| `path` | text, indexed | the visited path, e.g. `/articles` |
| `visitor` | relationship → Users, optional, indexed | blank for a signed-out visitor. **Staff visits are never logged** — `logPageView` returns early for a staff session, so there's no row at all, not just a blank visitor |
| `createdAt` | date (Payload built-in) | when the visit happened |

- Logged from `src/components/SiteNav.tsx` — every front-end page renders `<SiteNav />` directly in its own tree (not via the shared root layout, which Next.js doesn't re-run on every client-side navigation), so this fires once per real page view rather than once per hard page load.
- `src/proxy.ts` (Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts` — same thing) stamps the current path onto an `x-pathname` request header (Server Components don't otherwise receive the URL); SiteNav reads it and calls `src/lib/logPageView.ts` inside Next's `after()` (runs once the response has already been sent, so logging never adds latency to the page). Admin (`/admin`) and API routes are excluded from its matcher — Payload has its own session activity for staff CMS use, and API calls aren't page views.
- `access.create` is `() => false` for everyone — the only writer is the server code above, via `overrideAccess: true`. `read` is gatekeeper+; it's an immutable log (`update: () => false`), deletable by admin only, same pattern as `mailchimp-outbox`.
- `pnpm seed` wipes this collection like the other logs.

### Analytics dashboard (`/admin/analytics`, gatekeeper+)

A custom Payload admin view, not a front-end page — lives inside `/admin` like the rest of the CMS, with its own sidebar entry ("Reporting" → "Analytics", gatekeeper+ only, via `admin.components.afterNavLinks`). Registered as a top-level custom view (`admin.components.views.analytics` in `payload.config.ts`, `path: '/analytics'`), styled with its own scoped `.nic-analytics` rules in `src/app/(payload)/custom.css` using Payload's theme CSS variables (`--theme-*`) so it follows the admin's light/dark mode rather than the front-end's design system.

Six tabs, mostly server-rendered (plain `<form method="GET">`s, no client JS) except where noted:

- **Overview**: total views, views and unique signed-in visitors in the last 30 days, and top-15 lists (by view count) for sections, pages and users — each row links into the matching drill-down tab.
- **By user**: type-ahead search by first name, last name or email (`UserSearchPicker`, client component, 300ms debounce, 3-character minimum — a plain dropdown doesn't work at 1000+ users), hitting `GET /api/admin/users-search` (gatekeeper+, same access level as the dashboard). Picking a result links to `?tab=users&userId=...`, which shows that one user's full page-view history (most recent first). The matching logic is `buildUserSearchWhere` in `src/lib/userSearch.ts` (pure, tested).
- **By page**: pick one exact path (from the distinct paths actually seen, sorted by view count) — "page" here means a literal path, so `/articles/42` and `/articles/17` are different pages, not merged.
- **By section**: pick a section, see every visit within it across all its pages.
- **Publications**: search sent issues by publication/date range/title keyword and see opens, clicks and computed rates per issue, plus totals and averages across the whole matched set — see "Delivery stats and the Publications analytics tab" above for where the numbers come from.
- **Ads**: every PublicationAd, optionally filtered by publication, with impressions, clicks and a computed click-through rate, plus totals across the matched set — see the PublicationAd section above for what "impressions" means here (`src/lib/adAnalytics.ts`).

"Section" is not a stored field — `src/lib/pageSections.ts` buckets a `path` by prefix (Tracking/Guides/Data/Publications/Events/Dashboard/Account/Sign up/Staff tools/Home/Other), mirroring the main nav's own groupings. It's computed on read in `src/lib/analytics.ts`, so reclassifying a path there applies retroactively to history already logged, and nothing needs a migration if the mapping changes. Aggregation (Overview, By section) pulls up to 10,000 recent rows into memory and groups them in JS rather than via DB aggregation — fine at this project's scale, would need revisiting at real production traffic volume.

`src/lib/analytics.ts` and `src/lib/pageSections.ts` are framework-agnostic (just take a `Payload` instance) — this is the second consumer of them after the original front-end version of this dashboard, which is gone; `/admin/analytics` is now the only copy.

## Open questions

1. **Unsubscribe follow-up:** what happens with an EmailFlag (e.g. email the relationship manager), to be defined later.

## Changelog

- 2026-10-14: Replaced estimated PDF row chunks with measured pagination and table-scoped repeated titles/headers, fixing mid-page duplicate headers and headerless continuations. Added Nicotine360 cover/running-header branding from the existing logo and total-page counts. Regenerated the August 2026 report (119 pages), checked the cigarette-paper transitions, and added an adjacent-category pagination/logo regression.

- 2026-10-14: Repaired pg NUMERIC string concatenation in trade-report aggregates and chart series; validated numeric ranges and dataset values; added offline database-response/PDF-layout regressions and opt-in read-only local integration checks. Added preview/readiness commands and a restore preflight that refuses existing trade schemas. Corrected the destructive schema setup instructions and stale guide/publication documentation. Existing generated PDF files must be regenerated; production initialization is still unverified.
- 2026-10-14: Regenerated the repaired August 2026 PDF (126 pages) and visually checked summary and country-detail pages 4, 5, 21, 46, and 86. The original overlapping digit strings are resolved in those samples. Source-workbook numeric ranges and merged sums are also validated to prevent similar ingestion errors.

- 2026-10-14: Added the US Tobacco Trade Barometer monthly trade-report feature — see "US Tobacco Trade Barometer" and "TradeImportRun" above for the field-level detail. Ports a previously-standalone, independently-validated proof of concept (`ttb-trade/`) rather than building from scratch. Built the first real PDF renderer in this codebase (`src/lib/ttb/report/pdf.tsx`, `@react-pdf/renderer`) to replace what would otherwise have been another placeholder PDF; the trademark-report publications above still use the placeholder, since there's no equivalent chapters/data/format layer feeding them. Verified end to end locally (real sample Census files, real restored historical data): both files loaded with YTD checks passing at 0.00% diff, country names resolved correctly into the US Exports/US Imports Datasets (e.g. `ZW` → `Zimbabwe`), and a draft issue was created with a real ~994KB PDF attached. Not yet done: the same one-time schema-create + historical-data restore this was tested against locally still needs to happen against Railway's production Postgres.
- 2026-10-13: Applied the real current-membership list (`migration/applyMemberPlans.ts`, staff-provided, not derived from old-site data): Key Sponsor or any "Platinum" N360 note -> premium (24 providers), every other listed member -> base (73 providers), status set to live and any stale `licenseExpiresAt` cleared for all of them (a current list implies no known expiry, and several carried an expired date from the original migration that would have left them ineffective despite `status: live`). Everything not on the list stays/resets to `plan: none`. Matching to provider ids was done by hand against the real 180-row provider list, not string-matched at runtime — several old near-duplicates the automated merge didn't catch (e.g. three separate "Core-Mark..." rows, "ITG Brands, LLC" vs the typo "ITG Bands, LLC") needed a human call, and a few are still unresolved: KS BAT RAI Services Company, Pillar HC, Republic Brands, and whether Citi/Citi Research are the same real member as Citigroup Global Markets Inc. Two real members (PT Djarum, Cigar Rights of America) have no Access Provider at all — no migrated users ever existed under them. This unblocked the Mailchimp preferences work below: 518 real users are now plan-eligible (up from 0), and re-running `applyMailchimpPreferences.ts` genuinely persisted preferences for 366 of them this time.
- 2026-10-13: Built `migration/applyMailchimpPreferences.ts` (maps the 10 real Publications to their Mailchimp interest ids, matched by name, and sets `emailPublications` on real migrated Users who are 'subscribed' with a matching interest on) — then found it currently can't do anything. The existing `syncMailchimpOnUserChange` hook correctly clears `emailPublications` for anyone whose company isn't currently plan-eligible, and every real Access Provider still defaults to `plan: none` except Altria (upgraded to `base` by the provider-merge), whose license expired in September 2025 — so zero real users qualify right now. Not a bug; gated on the already-known manual step of assigning real plan/status/expiry to actual paying companies. Re-run the script after that.
- 2026-10-13: Moved account email (verification, password reset, invites) off Mandrill onto AWS SES — now one email system end to end, sharing credentials with the publication-issue bulk sender (`src/lib/ses/`). Added a hard safety net first, since real migrated user data is live in non-local environments: `src/lib/emailSafeMode.ts`, a nodemailer "compile" plugin applied to the transport regardless of which one is active (SES or the console dev fallback), redirects every outgoing email's `to`/`cc`/`bcc` to a safe address and notes the real recipient(s) in the subject line. Safe by default — requires an explicit `EMAIL_SAFE_MODE=off` to actually deliver to a real recipient, rather than requiring something be remembered to turn on. Recommended second layer, infrastructure-level: keep the SES account in sandbox mode (AWS's own default for new accounts), which physically can't deliver to an unverified address regardless of app-level config. Mailchimp is not an ongoing sender at all — confirmed it was only ever meant as a one-time source for the old site's subscriber/interest data (already pulled, `migration/pullMailchimpSubscribers.ts`), not something to send through; `EMAIL_PROVIDER` now defaults to `ses`.
- 2026-10-13: Removed the seed script's placeholder demo content now that real migrated data exists for these collections (`migration/removeSeedPlaceholders.ts`): 5 placeholder Staff, 12 placeholder Users (several had a real company as their Access Provider, since that provider's own seed placeholder had already been merged into real data by name — the company is real, these specific people never were), 2 Access Providers with no real-world match ("ITC Limited", "Vapor Ventures LLC" — the other 6 seeded names were already merged earlier), the placeholder "InFocus: Harm Reduction Webinar" event and its session (the old site has zero real InFocus events — the channel is real, this example of it wasn't) and everything demo'd against it (orders, registrations, livestream pings), one demo "buy for a colleague" order against the real GTNF 2026 event, 25 placeholder Articles, 15 placeholder Bills, 10 placeholder Trademarks, and 21 placeholder Publication Issues. Hit one real pre-existing schema bug along the way: `EmailFlag.user` is required but its FK is `ON DELETE SET NULL`, which can never actually succeed — deleting a flagged user hits a NOT NULL violation instead. Deleted the one blocking row to get past it rather than fix the schema inline; worth a real look later. **`pnpm seed` is now dangerous to run** — its `WIPE_ORDER` still deletes every one of these collections before reseeding placeholder data, which would destroy all the real migrated content covered by this changelog. Needs a real decision (skip already-migrated collections entirely, split into a separate "dev extras only" script, or retire it) before anyone runs it again; not yet made.
- 2026-10-13: Removed 3,297 duplicate Bills (`migration/dedupeBills.ts`) — the old site's `bills` table itself has 770 groups sharing an identical (title, bill_number) pair but different ids, with `created_at` spread over weeks or months (one bill appeared 46 times) and the same `bill_date` every time, pointing to a periodic re-check job that re-created the row instead of updating it. The live old site doesn't show these as duplicates (confirmed from a screenshot — a bill title repeating 3x in the admin list that the team said has no duplicate on the current site), so this migration should have collapsed them from the start and didn't. Kept the most-recently-created copy of each group, deleted the rest, and re-pointed the 4,790 Publication Issue section references that had pointed at a since-deleted duplicate onto the surviving canonical bill first (`bills` cascades on delete from `publication_issues_rels`, which would have silently dropped that bill out of whichever issue listed it). Also fixed `migration/importBills.ts` itself to dedupe at import time, so re-running the full migration from scratch doesn't reintroduce the problem.
- 2026-10-13: Found the real location data for Articles and Bills after all — the first content migration pass concluded there was none (checked the dedicated columns, the denormalized text arrays, every `excerpt_indices` taxonomy category, and the unused `index_terms` table), which turned out to be wrong. The live old site has a Google-Places-backed address picker (confirmed from a screenshot of its admin form and devtools), backed by a polymorphic `addresses` table (`addressable_type`/`addressable_id`) that the word "location" never appears in, which is why it was missed. 42,413 rows total (10,781 Article, 14,928 Bill, plus Trademark/Law/Agenda/Event) — each tagged place is stored as multiple rows, one per hierarchy level (region, country, sometimes state), all crammed into one oddly-named `country` text column regardless of actual level, with no explicit level flag. Built out the Locations tree from this (`migration/buildLocationsAndTagExcerpts.ts`): 6 regions, 199 countries (reusing the `COUNTRIES` list from the dataset migration, now exported), 81 states/provinces (all US states + DC + Puerto Rico + Guam, Canadian provinces, Australian states, the 4 UK constituent countries, 3 Indian states that showed up in the data) — level inferred by matching each old text value against this list, since the old data never recorded which level a value was. Scope, confirmed: region/country/state only; left out the long tail of ~80 one-off cities/counties (mostly 1-3 uses each). A few informal sub-regions in the old data (Middle East, Caribbean, Latin America, Central America, Western Europe, Northern Africa) were folded onto their nearest real continent rather than kept as confusing parallel region nodes; non-geographic values (World, European Union, Non-European Union) were dropped. Result: 8,969 Articles and 8,640 Bills tagged with real locations.
- 2026-10-13: Migrated Events, Sessions, Speakers and Sponsors (`migration/importEvents.ts`): 6 real conferences (GTNF 2024/2025/2026, ATNF 2025/2026/2027), 178 sessions, 261 speakers (real bios recovered — the old `description` column was a JSON-encoded plain string, not EditorJS blocks like everywhere else), 37 sponsors, and the real GTNF 2026 livestream URL (extracted from an old `<iframe src="...">` embed, since the structured `link` column was empty). Matched Events/Speakers/Sponsors by name/title against the seed placeholders, so e.g. "GTNF 2026" updated in place with its real dates rather than creating a confusing duplicate. Relaxed `Sponsor.logo` from required to optional — the old site never stored a sponsor logo image, only the company name, and fabricating 37 placeholder logos felt worse than leaving the field blank. Deliberately **not** migrated: `attendees` (864 rows) and `discounts` (109 rows) — the only ticket-shaped old data (25 rows in the e-commerce `products` table tagged category='Ticket') isn't linked to any event and has prices that look like test data ($5/$4, $3.40/$0); every EventRegistration here requires a real Order with a ticketType/attendance/amountPaid, and fabricating those for 864 real past attendees would manufacture fake-looking financial records.
- 2026-10-13: Migrated 68,300 historical Dataset rows across the 11 already-seeded Datasets that have a real old-site equivalent (`migration/importDatasets.ts`) — tariffs, tax rates, cigarette market share, production/consumption, US trade. The old site's `data_collections` (the 14 dataset definitions) are all marked status='Draft', but that only meant "never promoted to a public nav item" — the row data itself (in a separate `datasets` table, confusingly — one old table per logical idea, two different names) is real and substantial; it's in fact where the seed script's own "e.g. 3,559 rows" comment came from. Reused the real import pipeline (`commitImport`, the same code the staff upload wizard calls) instead of a parallel insert path. Along the way, found the Countries reference list had only 12 entries — the first import pass showed hundreds of totally ordinary country names (Afghanistan, Spain, Italy, Argentina, ...) falling back to raw text instead of resolving to an iso2 code, simply because those countries didn't exist as records. Expanded `COUNTRIES` (`scripts/seed/data.ts`, now exported and reused by a new one-off `migration/applyFullCountryList.ts`) to all 199 real sovereign states plus common alias spellings seen in the old trade data (e.g. "Taiwan, China", "Georgia (Republic of)", "Burkina" for Burkina Faso), re-ran the import, and got the unmatched count down to a long tail of genuine non-sovereign territories (Aruba, Bermuda, French Guiana, Western Sahara-type entries) that a "countries" list legitimately shouldn't include.
- 2026-10-13: Migrated 3,109 published Publication Issues (`migration/importPublicationIssues.ts`). The old schema's naming is a trap: `publication_categories` is the recurring newsletter definition (what our `publications` collection is), and `publications` is the per-issue table (what our `publication-issues` collection is) — confusingly the same name as our top-level collection, a completely different thing. Only the 10 categories that already exist as real Publications here were in scope (16 others — unused trade barometers, dated one-off China Watch issues, etc. — were already confirmed out of scope earlier). Each issue's real content came from `publication_pages`, a polymorphic ordered list of Article/Bill/Trademark references, resolved against the content migration's `ingestion.externalId`. Added `PublicationIssue.legacyId` for the same idempotency reason as the other migrations. Two of the 10 publications (the trademark reports) are configured `pdf-report` with no actual old PDF to carry over, so their historical issues were built as `excerpt-list` instead (the real trademark lists still exist and are worth keeping) — the parent Publication's own format is untouched, since that only governs how *future* issues get generated. Only ~20% of issues (612 of 3,109) turned out to have any linked items at all in the source data — checked directly against `publication_pages`, not a migration bug: most day-to-day sends apparently weren't tracked at this granular a level, only the trademark reports and a fraction of the clippings were.
- 2026-10-13: Migrated published Articles (9,430), Bills (9,462) and Trademarks (13,530) from the old site (`migration/importArticles.ts`, `importBills.ts`, `importTrademarks.ts`) — the full "everything, all three types, published only" scope. Body text came from each old EditorJS-blocks field (`full_text` for Articles — short, ~358 chars average, a preview not a full body; `abstract`/`content` for Bills) via a new tested pure function, `editorJsToParagraphs()` (`src/lib/editorJsImport.ts` — every real block across the dataset is `type: "paragraph"`, so it deliberately doesn't handle anything else). Sector/Product/Subject tags came from `excerpt_indices`, resolved against the taxonomy import's names (Sectors/Products) and `legacyId` (Subjects). Sources (1,701 of them) didn't exist as real data anywhere — derived instead from `source_title`, the only real signal, since `sources` itself is empty and `source` is a dead field (always the literal string of an empty Ruby hash). Trademark images aren't re-hosted (13,530 external USPTO URLs, many already 404ing per the schema's own comment) — left for the weekly USPTO job to backfill later. Two real bugs caught while verifying rather than left in: (1) `buildSearchTextHook` had no length cap and a few Bills' full legislative text exceeded the field's 40,000-char max — capped in the hook itself, not just the migration; (2) the date-fallback chain (`sourceDate`/`billDate`) picked the first non-empty raw value and only validated *that one*, so a single corrupt row (one Bill had `bill_date = "0015-12-30"`, presumably a typo for 2015) fell all the way through to "now" instead of trying the next candidate — fixed to validate each candidate in turn, plus a sanity year-range guard (1900–2100) in `toISO()`.
- 2026-10-13: Relaxed `locations`/`sectors`/`products`/`primarySubject` (shared by Article and Bill via `indexTermFields()`) and Bill's own `locations`/`governmentLevel` from `required: true` to optional. Surfaced while migrating real old-site content: only ~47% of published Articles and ~56% of published Bills were ever tagged with any Subject/Sector/Product, almost none had a Location, and ~43% of published Bills had no usable `government_level` value — a hard requirement would have rejected roughly half of real content rather than reflecting how the old site was actually used. Staff can still fill gaps in later; nothing about user access changed.
- 2026-10-13: Migrated real Access Providers and Users from the old site's `accounts`/`account_users`/`users` tables (`migration/importAccountsAndUsers.ts`). Scope, confirmed by hand against the data rather than guessed: of 2,523 old accounts, only the 255 with a non-null status and not personal/individual qualify, minus 4 internal accounts (the org's own account, the build agency, two test accounts) = 251 real companies. Of 3,899 users under those accounts, only 670 were ever marked Active or (Blocked + signed in at least once) — the other 3,556 never logged in even once (2,828 of those were bulk-confirmed in one backend batch on 2025-04-25, not real activity) — minus a few staff/agency identities under @nicotineresource.org, @gtnftrust.org and all 29 @truegroup.agency "dev+company" QA logins = 626 real users. No passwords migrated (old bcrypt hashes aren't usable); every imported Staff/User gets a random throwaway password and must use "forgot password."
- 2026-10-13: Merged duplicate Access Providers (`migration/analyzeDuplicateProviders.ts` + `mergeDuplicateAccessProviders.ts`): the old site had the same real company spread across many near-duplicate account rows (punctuation/legal-suffix variants like 4 copies of "22nd Century Group", or a shared email domain under different names, e.g. "PMI" / "Philip Morris International" / "Philip Morris USA"). Clustered all 253 providers by normalized name or shared domain (unioned transitively), merged 38 clusters into one canonical provider each (highest user count wins, keeping whichever status/plan in the cluster grants the most access), reassigned every affected User, and deleted the 71 duplicates. Confirmed with the team that British American Tobacco should absorb R.J. Reynolds/Reynolds despite being the largest, highest-stakes cluster (114 users) rather than leave the 2017 BAT/Reynolds American acquisition split across providers. 182 providers remain. No more "primary account" concept — merging fixed the root cause of users having been split across duplicate accounts in the first place.
- 2026-10-13: Added front-end login/logout, which hadn't existed at all — `/account` only ever showed "you need to be signed in" with no way to actually do that, and signup's "Already have an account?" link pointed at that dead end. Added `/login` (`LoginForm.tsx`, posts to Payload's `/api/users/login`), `/forgot-password` (`ForgotPasswordForm.tsx`), and a `LogoutButton` wired into `SiteNav` for both users and staff (posts to `/api/{collection}/logout`, since they're separate auth collections). The admin back end already had a built-in logout (Payload's default account menu) — confirmed it survived the custom branding pass.
- 2026-10-13: Migrated taxonomies (`migration/importTaxonomies.ts`): the old site's `taxonomies` table turned out to be real, current data (built in 2025), not legacy cruft — confirmed every one of the 59,877 real tag assignments in `excerpt_indices` points at a Sector, Product, or Subject term, nothing else (the table also has a few categories like TTG/TUSA/Section that are never actually used for tagging anything — left out). Added 8 Sectors, 73 Products, and the full 855-node Subject tree on top of the seed placeholders (merged by name for the first two; Subjects always created fresh, since 97 of the 855 names legitimately repeat under a different parent — name-based matching would have wrongly collapsed distinct branches). Added `Subject.legacyId` (the old `taxonomies.id`) since name alone can't identify a subject uniquely; needed to resolve `excerpt_indices` during the Article/Bill/Trademark migration. Locations and Sources have nothing to migrate — the old `sources` table is empty and `bills.location` is blank on all but 31 of 9,498 rows.
- 2026-10-13: Decided not to migrate `laws` (2,379 rows, 9,511 real tag assignments — actively used, not a relic). There's no `laws` collection in the new schema, and `laws.bill_id` is too unreliable to fold them into Bills cleanly (e.g. one bill_id is shared by three unrelated laws from different countries). Left out of scope for now rather than force a bad fit or build a whole new collection for it; can revisit later.
- 2026-10-12: Corrected Guides access — it was built (and documented, in both this file and CLAUDE.md) as a blanket "Base or Premium" collection, same as Publications. Real business rules, surfaced while mapping the old site's data for migration: Base gets Publications but not Data or Guides, and a handful of specific guides are deliberately open to Base subscribers too. Added `Guide.requiresPremium` (checkbox, default `true`) and `canReadGuide` (`src/access/guidesAccess.ts`) — Premium sees everything, Base sees only `requiresPremium: false` guides, via a `Where` clause so the list query and the document read are scoped identically. Seed data: of the 5 real guides, FDA Regulation, EU-TPD and FCTC are the Base-accessible exceptions; US Tax Guide and Int'l Tax & Tariff Guide stay Premium-only.
- 2026-10-12: Replaced Payload's default branding with Nic360's own (`admin.components.graphics.Logo`/`Icon` in `payload.config.ts`, new `src/components/admin/graphics/`): the full wordmark (`public/logo.png`) on the login screen, and a new icon-only globe mark (`public/icon.png`) everywhere Payload shows its own small icon (nav, collapsed sidebar) plus the browser favicon. Also set `admin.meta.titleSuffix` so admin browser tabs read e.g. "Login - Nic360" instead of the Payload default. No schema change — pure config + static assets.
- 2026-10-12: Built event analytics: advanced attendee reporting plus live attendance tracking for the event's livestream. **Pivoted mid-build**: the first version tracked per-session video playback (a `Session.replayVideoUrl` field, a tracked `<video>`/Vimeo-SDK player, a `session-views` collection accumulating watch-seconds) — but attendance is actually all one Vimeo livestream embed at the *event* level, swapped by staff as needed per day, and the team explicitly doesn't want deep Vimeo SDK integration (they pay Vimeo precisely to not deal with video hosting/streaming themselves). Replaced that with `Event.hasLivestream`/`livestreamUrl`, a `/events/:id/livestream` page, and a `livestream-pings` collection logging a presence ping every 2 minutes a registered attendee has the page open (`LivestreamPresence.tsx`, no player SDK at all). "Which sessions did they watch" is now inferred after the fact by matching ping timestamps against the session schedule (`matchPingsToSessions`, pure, tested) — see the new "Livestream attendance," "LivestreamPing," and "Attendee report" sections above. Removed the abandoned per-session pieces entirely (`SessionReplayPlayer.tsx`, `session-views`, the `@vimeo/player` dependency) rather than leave dead code. **Incident during the pivot**: a verification script run in the background performed its own schema reconciliation at the same moment the dev server's hot-reload also reconciled schema for the `session-views` removal, and both tried to drop the same FK constraint — one succeeded, the other then failed because it was already gone, which took the whole site down (every page failed at `getPayload()`). Fixed by inspecting the live schema directly (confirmed `session-views` itself had already fully dropped; the only leftover was an orphaned, constraint-less `session_views_id` column on Payload's internal `payload_locked_documents_rels` table) and dropping that column directly, then a normal dev-server restart completed the rest of the migration cleanly. Lesson: destructive schema changes (collection/field removal, not just addition) shouldn't be verified by a script running alongside a live dev server — ask for a restart first.
- 2026-10-12: Imported 25 licensed Adobe Stock icon SVGs (dropped in `icons/`) as React components via a new `scripts/importIcons.ts` (re-runnable — add more SVGs to `icons/` and rerun to regenerate `src/components/brandIcons.tsx`). Each source file defines its two fill colors as generic `.cls-1`/`.cls-2` classes, which would collide if inlined as-is (multiple icons on one page sharing the same class names); the script strips those and bakes each class's color into a `fill="..."` attribute directly, mapped to `--nrc-primary-dark`/`--nrc-secondary` by actual luminance (the three source packs didn't agree on which class number got the dark vs. light color). Wired six of them into the matching list pages' `<h1>` (Bills→Law, Trademarks→Stamp, Guides→Documentation, Publications→Journal, Events→Schedule, Data→Dashboard) via a new `.page-heading` style — these are detailed two-tone icons, not flat white silhouettes, so they sit on the plain page background rather than in the product-card gradient badges (which need a solid-white icon to read against a colored background).
- 2026-10-11: Design pass on three "feels unfinished" spots (no schema changes): (1) the main nav had zero `@media` queries anywhere, so its 5 dropdowns would overflow on a phone — added a CSS-only (checkbox hack, no client JS) hamburger panel below 900px that stacks the dropdowns and auth links instead of floating them; (2) `renderIssueEmailHtml` output completely unstyled HTML — rewrote it as a table-based, fully inline-styled template (email clients don't reliably support external/`<style>`-block CSS) matching the site's brand colors/fonts, with a colored masthead, styled ad cards (now `<div>` rows instead of `<ul><li>`, simpler to inline-style), and a styled PDF download button; (3) the dataset AG Grid used AG Grid Community's default look — themed it via `themeQuartz.withParams(...)` (the Theming API, not the old CSS-class themes) to match the brand palette, referencing the same `var(--nrc-*)` custom properties as the rest of the site. Verified the new email template by rendering a real seeded issue (with sections and ads) end to end and inspecting the output HTML directly, rather than just trusting it compiled.
- 2026-10-11: Added Publication header/footer HTML (`Publication.header`/`.footer`, rendered before/after the tracking content or PDF link in both the email template and the web issue page) and a new `publication-ads` collection ("Publication Ads" in the admin nav, under Guides & Publications) for per-publication, ranked, date-windowed image ads. Ads rotate into a slot before story 1, then every 2 stories after, shared placement logic in `src/lib/publicationAds.ts` (tested) used by both renderers. Clicks route through `/api/ads/[id]/click` (public, counts then redirects) rather than linking straight to the advertiser, so click counting doesn't depend on Mailchimp/SES. Added an "Ads" tab to `/admin/analytics` (`src/lib/adAnalytics.ts`) with impressions/clicks/CTR per ad — see the new PublicationAd section above for the impressions-counting caveat. Verified directly against the real schema: a bad `endDate`/`link` is rejected by field-level validation, and deleting a Publication while an Ad references it fails (blocking FK), confirming `publication-ads` must be wiped before `publications` in the seed script.
- 2026-10-11: Adapted the existing `tma-ext/` Chrome extension (previously built for the old TrueCMS/Strapi backend) to this Payload app. New `src/app/api/extension/{login,articles}` routes (local API + their own narrow CORS, not the main REST API — see the new Article section above) replace the old Strapi-shaped REST calls. The extension itself was reworked: on-demand page scraping via `chrome.scripting.executeScript` in place of an always-on `<all_urls>` content script (which, combined with a `default_popup`, also meant the old `background.js`'s `onClicked` handler could never fire — dead code, now removed along with the background service worker entirely), a popup that shows an editable preview (title/excerpt/source) before saving instead of sending blind, dedup by `sourceUrl`, and a tightened CSP (no more `unsafe-inline`/external CDN). Added `'extension'` as an `ingestion.source` option (shared field, also used by Bills/Trademarks).
- 2026-10-11: Replaced the Analytics dashboard's "By user" dropdown with a type-ahead search (`UserSearchPicker`, `/api/admin/users-search`, `src/lib/userSearch.ts`) — the old `<select>` listed up to 500 users, unworkable with ~1200 users. Searches first name, last name and email with a 3-character minimum, debounced 300ms client-side.
- 2026-10-11: Added an AWS SES option (`EMAIL_PROVIDER=ses`) for sending publication issues alongside Mailchimp, and delivery-stats tracking regardless of which provider sent an issue. `PublicationIssue` gained `email.provider` and a `stats` group (recipients/delivered/opens/clicks/bounces/complaints). New: `src/lib/ses/` (simulated/live client, mirrors `src/lib/mailchimp/`), `/api/ses/webhook` (SNS-delivered SES events → EmailFlags for bounces/complaints, atomic stat increments for delivery/opens/clicks), `src/lib/suppressionList.ts` + `src/lib/publicationRecipients.ts` (compute the send list fresh at send time instead of syncing a standing Mailchimp audience), `ses-outbox` collection. Extracted `flagUserByEmail()` (`src/lib/emailFlags.ts`) out of the Mailchimp webhook so both providers share the same EmailFlags behavior. Added a Publications tab to `/admin/analytics` (`src/lib/publicationAnalytics.ts`) to search issues and see totals/averages — see the new "Delivery stats" section above.
- 2026-10-10: Built site search on Postgres full-text search (not the Payload search plugin named as the earlier default) and extended the Articles/Bills/Trademarks list pages: keyword + date range on all three, plus the existing sector/product/subject/location filters on Articles/Bills. Added a hidden `searchText` field (richText stripped to plain text) to Articles and Bills for the full-text index; Trademarks needed no schema change. See the new Search section above.
- 2026-10-10: Moved the analytics dashboard from a front-end page (`/staff/analytics`) into Payload's admin panel as a custom view (`/admin/analytics`, gatekeeper+), with its own sidebar nav entry. Same query layer (`src/lib/analytics.ts`, `src/lib/pageSections.ts`), new admin-native UI (`src/components/admin/analytics/`, `src/components/admin/AnalyticsNavLink.tsx`) styled via `--theme-*` CSS variables in `src/app/(payload)/custom.css` so it respects the admin's own light/dark mode. The old front-end route is gone.
- 2026-10-10: Built out the analytics dashboard: overview stats plus by-user/by-page/by-section drill-downs. `PageView.visitor` changed from a polymorphic Users-or-Staff relationship to a plain relationship to Users only, and `logPageView` now skips staff entirely (no row logged) rather than logging them with a Staff visitor — staff traffic isn't part of what this dashboard tracks.
- 2026-10-10: Added first-party page-view analytics (`page-views` collection, `src/proxy.ts`, `src/lib/logPageView.ts`) in place of a third-party tool like Google Analytics, since every page is already behind a login — see the new Analytics section above.
- 2026-10-09: Added `User.lastLoginAt` (read-only, shown in the admin list), set by a new `afterLogin` collection hook rather than an `afterChange` one, so it doesn't interact with the existing Mailchimp-sync/access-provider hooks. Added Vitest (`pnpm test`) with a first batch of unit tests for pure logic: the TMOG classifier/parser, event ticket pricing, user access plan derivation, and CSV import mapping.
- 2026-10-09: Real USPTO trademark import built (`src/lib/tmog/*`, `src/jobs/tmogImportTask.ts`), replacing the fixture as the production path: streams the weekly TMOG XML with `saxes`, filters to class 34, classifies by TMOG section (not the stale `MarkCurrentStatusCode`), fetches per-mark images (throttled, missing-tolerant), and upserts `trademarks`. Runs every Friday via Payload's job-queue cron (`jobs.autoRun` + the task's own `schedule`), is idempotent per issue date, and supports a manual run for one specific issue. `Trademark.image` is now optional (was required — a 404'd image must not fail the run); added `Trademark.goods`. `TrademarkImportRun` gained `issueDate` (for the skip-already-succeeded check) and per-status/image counts. The "build draft weekly/monthly report issues" step was extracted into `src/lib/trademarkReportIssues.ts`, shared by both the real job and the original fixture-based one (kept for offline testing).
- 2026-10-09: Added a "Manage this event" one-screen dashboard (`/admin/events/:id/manage`, linked from the Event's admin edit screen) so staff running one event don't have to re-pick it on every related admin screen. Added a `speakers` field to Events (hasMany → Speakers, mirroring the existing `sponsors` field) and its reverse `events` join on Speakers, so speakers can be attached to an event directly rather than only through sessions.
- 2026-10-09: Publications' grouping field changed from a single-select `section` (News/Policy/Trademarks) to a multi-select `category` (News/Legislation/Trademarks, hasMany) so a publication could in principle draw from more than one tracking category, though in the current seed data each one only has a single category: all six executive-summary/news-clippings/research-digest publications are News; the two legislative ones are Legislation; the two trademark ones are Trademarks. The main nav's Publications dropdown and the `/publications` page group by this field.
- 2026-10-09: Main nav reorganized: Guides and Data are now dropdowns. Guides lists the 5 real guides (US Tax Guide, Int'l Tax & Tariff Guide, FDA Regulation, EU-TPD, FCTC) — seed data replaced the two placeholder guides with these. Data lists real datasets grouped by a new required `category` field (Policy/Markets/Trade); seed data now covers all 11 real datasets (2 with imported sample rows, 9 as catalog entries pending real data). Publications seed extended to the real list minus the old site's Economics section and FDA Watch (both dropped, not carried forward).
- 2026-10-09: User-facing naming: the admin sidebar group for Articles/Bills/Trademarks is now "Tracking" (was "Excerpts" — that term stays as the internal schema name, see below). Articles are labeled "News" and Bills are labeled "Legislation" in the admin and on the front end. The front-end main nav consolidates News/Legislation/Trademarks under a single "Tracking" dropdown.
- 2026-10-08: User `firstName`/`lastName` no longer required at the schema level (the new code-based sign-up flow creates the account before the user has a profile); added `signup` group (`code`, `codeExpiresAt`, `completedAt`) to track that flow's state. Front end: `/signup` (email → code → profile, with self-serve "create your company" when no Access Provider matches), `/signup/finish` (publication preferences or a contact-us + next-event notice), and a tiered `/dashboard`.
- 2026-10-08: Added Staff roles (editor, gatekeeper, admin) and Services. Project brief written at /mnt/project-files/brief/CLAUDE.md.
- 2026-10-08: Added Trademark reports: Weekly US Trademark Report and Monthly US Trademark Activity are generated by a scheduled USPTO job as draft PDF issues; publications get a `generator` field; TrademarkImportRun log added.
- 2026-10-08: EmailFlag gets a Re-add action (staff delete the contact in Mailchimp first, as today).
- 2026-10-08: Mailchimp unsubscribes are honored via webhook and open an EmailFlag for follow-up. The CMS creates and sends each issue's campaign from a Send button with confirmation.
- 2026-10-08: Publications reworked: any subscriber can read; per-publication selection rules (date window, locations, products, etc.) and grouping/sorting rules with a Build-from-rules step; Mailchimp ids per publication; user email preferences synced one way to Mailchimp. Locations get a parent hierarchy.
- 2026-10-08: Data: replace toggle (on by default), premium download, two datasets dropped. Added Publications (newsletters) and Issues in three formats: excerpt list, PDF report, custom HTML.
- 2026-10-08: Added Guides (title, description, thumbnail, protected PDF). Guides are open to any subscriber, not premium only (corrects earlier note).
- 2026-10-08: Added Data: staff-defined Datasets with column definitions, spreadsheet import with column mapping, rows stored as JSON, Countries reference list, shown in AG Grid (premium only).
- 2026-10-08: Trademark Style/Design are Yes/No/N/A. Business Sector stays separate from excerpt Sectors.
- 2026-10-08: Ticketing reworked: honor-system eligibility, separate in-person and virtual prices per ticket type, Orders added so one buyer can buy tickets for colleagues. No sponsor levels.
- 2026-10-08: Added Sponsors (shared pool assigned to events; sessions pick from the event's sponsors). Speakers always show current role/company.
- 2026-10-08: Added Sessions (agenda items: keynote, panel, break, other) and Speakers (used for moderators and speakers; external links dropped).
- 2026-10-08: Added Ticketing: ticket types per event with standard and subscriber prices, company discount codes (25–100% off, limited uses), registration now records ticket type, price basis and code. Subscribers get no free events.
- 2026-10-08: Added Events: channels as code config (ATNF, GTNF, InFocus, future NRC); Event collection with only name and dates required; Event Type dropped; EventRegistration sketched (inferred).
- 2026-10-08: Provider `plan` is None/Base/Premium, set by staff (trials too). User purchases are now event registrations only (conferences, webinars, workshops); old product orders not carried over. "Conference" widened to Event.
- 2026-10-08: Added Accounts (User, AccessProvider) from *N360 Account Entities.docx*; premium is an add-on to base; subscriptions are set up manually by staff, no prices.
- 2026-10-08: Papa's answers: Link Stories dropped (unused); Trademarks stay unindexed; Bill status fields are typed by hand; access is by content type and company subscription (Access section added).

- 2026-10-08: First pass: Excerpts (Article, Bill, Trademark) and shared taxonomies.
