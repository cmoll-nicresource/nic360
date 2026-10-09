# Nic360 entity map

Living map of the site's content entities, written toward Payload CMS (Next.js + Postgres) with content gated by login / base / premium tiers set by the user's employer organization. Add new entities as new sections; keep the shared pieces in "Shared building blocks" so they stay in one place.

Source for this first pass: *N360 Excerpt Types.docx* (Papa, 2026-10-08), which shows the current admin screens for Articles, Bills and Trademarks. Field names below are the current UI labels; `camelCase` is the proposed Payload field name.

## Overview

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
| `ingestion` | group: `source` (manual · statenet · uspto · …), `externalId`, `importedAt` | **Proposed.** Lets importers upsert without duplicates |

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
| Subjects | name, `parent` → Subjects | Tree (parent > child); use Payload's nested-docs plugin |
| Locations | name, `parent` → Locations, `level` (region · country · state/province · city), geo point | Fed by the address autocomplete; one record per place, reused. Hierarchy (e.g. Pennsylvania > United States > North America) lets publication rules and filters match a place and everything inside it |
| Sources | name/domain | **Proposed.** Article "Source Title" holds a domain (*thekenyatimes.com*), which repeats across articles |
| BillTypes | name | e.g. *Bill*; small select list could also be a plain `select` |
| GovernmentLevels | name | e.g. *State/Province*; likely a fixed `select` (Federal, State/Province, Local, International) |

## Article

News found across the internet; we take the title and a preview and apply index terms.

| UI label | Field | Payload type | Req. |
|---|---|---|---|
| Article Title | `title` | text | ✓ |
| Source Title | `source` | relationship → Sources (or text) | |
| Source Link | `sourceUrl` | text (URL) | |
| Source Date | `sourceDate` | date | |
| Article Excerpt | `excerpt` | richText (headings, lists, table) | ✓ |
| Location, Sectors, Products, Primary Subject, Subjects | index terms | see above | ✓ |

## Bill

Legislation tracked via StateNet, summarized and categorized. Admin screen has two tabs (Content, Index), which map directly to Payload `tabs`.

**Content tab**

| UI label | Field | Payload type | Req. in UI |
|---|---|---|---|
| Bill Type | `billType` | relationship/select | ✓ |
| Bill Number | `billNumber` | text, e.g. *H.1434* | ✓ |
| Title | `title` | text | ✓ |
| Location | `locations` | index term | ✓ |
| Bill Session | `session` | text/select, e.g. *Regular* | ✓ |
| Law Number | `lawNumber` | text | ✓* |
| Government Level | `governmentLevel` | select | ✓ |
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
| Sectors, Products, Primary Subject, Subjects | index terms | see above | ✓ |
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
| Class | `class` | text/number (Nice class) | |
| Company | `owner` | text | |
| Address | `ownerAddress` | text (address autocomplete) | |
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
| Renewed Owner | `renewal.owner` | text | |
| Renewed Address | `renewal.address` | text | |
| Trademark Image | `image` | upload → Media (PDF, PNG, SVG, JPG; max 1) | ✓ |

The event type a reader cares about (filing, registration, renewal, cancellation) can be derived from which dates are set, so no separate status field is proposed.

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

Access is decided by **content type and the reader's subscription**, never per item, so excerpts carry no access field.

| Content | Who can read it |
|---|---|
| Excerpts (Article, Bill, Trademark) | Base or premium subscription |
| Data | Premium subscription |
| Guides | Any subscriber (Base or Premium) |
| An Event: conference, webinar or workshop (to be mapped) | Users registered for that event |

- **Access provider** (to be mapped): the employer organization. Subscriptions are bought company-wide, and every user under it gets that provider's tier.
- **Provider with no active subscription** (typically expired): its users can read nothing.
- **Conference attendees**: get a user account with no access provider, so they can read only the event(s) they registered for.
- **Events** (conferences, webinars, workshops) are the only things sold to individuals; everything else is sold per company.

- **Premium is an add-on**: it includes everything in base and can't be bought without base.
- **No set prices**: most access comes through membership dues in the 501(c)(6) trade organization (dues scale with member market cap). Staff quote and set up new access providers and their subscriptions by hand in the CMS; only events are sold online.

In Payload, collection-level `access.read` functions check the reader's access provider (status, expiry, plan), or their registrations for events. See Accounts below.

## Accounts

Source: *N360 Account Entities.docx* (Papa, 2026-10-08): current Create User, example User, New Access Provider and example Access Provider screens.

```
 AccessProvider 1 ──── * User * ──── * Event   (via EventRegistration, grouped in Orders)
   (company, plan,         (member account)
    status, expiry,
    allowed domains)
```

### User (Payload auth collection `users`)

Someone who registers to use their company's subscription or to attend a conference.

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
| *(internal)* | `signup` | group: `code`, `codeExpiresAt`, `completedAt` — sign-up flow state, gatekeeper-only, not reader-editable | |

- `accessProvider` is empty for conference-only attendees.
- **Registration rule:** when a user verifies an email whose domain (or exact address) is in a provider's `allowedDomains`, an `afterChange`/verify hook sets `accessProvider` automatically.
- Business Sector here is a sign-up profile list, kept separate from the excerpt Sectors taxonomy (decided: not merged). A plain `select`.
- **Staff accounts** go in a separate auth collection, `staff`, so CMS logins never mix with member logins. See Staff below.

**Sign-up flow** (`/signup`): 1) email entered, a 6-digit code is emailed (`signup.code`/`signup.codeExpiresAt`, 15-minute expiry) — this replaces Payload's own link-based verify email for the public flow, though the link-based one still works for accounts created by other means; 2) the code is confirmed, which sets `_verified: true` and so fires the same `allowedDomains`-matching hook as before; 3) the reader sets a password and fills out their profile — if no Access Provider was matched, they can name their company instead, which creates a **Pending**, **None**-plan Access Provider for staff to follow up on; `signup.completedAt` is set, marking the account complete. 4) `/signup/finish` shows the publication-preference picker for an already-subscribed company, or a contact-us notice plus the next upcoming event for one that isn't.

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

- **Admin layout:** today's sections (General, Details, Location, Accommodation, Event Days) map to Payload tabs or collapsible groups.
- **Venue** is a plain group on the event, not the excerpt Locations taxonomy, because it's a specific street address. Online events leave it blank.
- **Event Days** today shows one row per date between start and end, with a blank name falling back to a suggested name. In Payload, a `beforeChange` hook fills in the rows from the date range and keeps any names already typed.

### Ticketing

Pricing varies by ticket type, by attendance (in person or virtual), by whether the buyer is a subscriber, and by discount code. Subscribers get no free events, only lower prices.

**Ticket types (`ticketTypes` array on each Event)**

| Field | Type | Example / notes |
|---|---|---|
| `name` | text | *General Admission*, *Public Health*, *Academia* |
| `honorSystem` | checkbox | buyer self-declares eligibility (Public Health, Academia); no check is made |
| `inPerson.price` / `inPerson.subscriberPrice` | number / number, optional | blank = no in-person option (e.g. InFocus); blank subscriber price = same as standard |
| `virtual.price` / `virtual.subscriberPrice` | number / number, optional | every type has its own virtual price |
| `capacity` | number, optional | |
| `onSale` | checkbox | |

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
| `status` | select: active · cancelled | |

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

- Agendas always show a speaker's **current** role and company, including on past events (decided, to keep it simple).
- Only `name` really needs to be required; making headshot and bio optional lets staff add a late speaker quickly.

### Sponsor (`sponsors`)

One shared pool, kept separately and assigned to events, since the same sponsors recur across events in every channel.

| UI label | Field | Payload type | Req. today |
|---|---|---|---|
| Company | `name` | text | ✓ |
| Logo | `logo` | upload → Media (PDF, PNG, SVG, JPG) | ✓ |
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
- **Front end:** AG Grid loads a dataset's rows from one API route (client-side sorting and filtering is fine at these sizes). The route checks the reader's plan is Premium.
- **Download:** premium readers can download a dataset as CSV/Excel, generated from the rows (respecting current filters is a nice-to-have).

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

Source: Papa's notes (2026-10-08). Readable by **any subscriber** (Base or Premium).

### Guide (`guides`)

| Field | Payload type | Req. |
|---|---|---|
| `title` | text | ✓ |
| `description` | textarea | |
| `thumbnail` | upload → Media (public image) | |
| `file` | upload → GuideFiles (PDF) | ✓ |
| `slug` | text, unique | ✓ |
| `publishedAt` / `_status` | Payload drafts | |

- **GuideFiles** is a separate upload collection holding only the PDFs, with read access limited to subscribers. Files are served through Payload's access-checked file route, never a public storage URL, so a shared link doesn't leak the PDF.
- Thumbnails stay in the public Media collection so the guide list can show them to everyone.

## Publications

Source: Papa's notes and Mailchimp screenshots (2026-10-08). Newsletters, readable by **any subscriber** and emailed through Mailchimp. A **Publication** is the newsletter (e.g. *US News Clippings*); an **Issue** is one edition (e.g. *US News Clippings - October 9, 2026*).

Known publications: Daily Executive Summary, Weekly Executive Summary, Global News Clippings (by region and subject), US News Clippings, Vapor News Clippings, Monthly Research Digest, Weekly US Trademark Report, Monthly US Trademark Activity.

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
| `slug` | text, unique | |
| `description` | textarea | e.g. *A weekly summary of key US industry news* |
| `thumbnail` | upload → Media | |
| `format` | select: Excerpt list · PDF report · Custom HTML | each issue copies it as its default |
| `frequency` | select: daily · weekly · monthly | sets the default date window |
| `selectionRules` | group, excerpt-list only (below) | |
| `groupingRules` | group, excerpt-list only (below) | |
| `generator` | select: Manual · Weekly US Trademark Report · Monthly US Trademark Activity | Manual for all except the two trademark publications (see Trademark reports) |
| `mailchimp.interestId` | text | the publication's checkbox in the audience's *Publications* interest group |
| `mailchimp.segmentId` | text | the saved segment ("Publications one of …") used when sending |

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
| `groupBy` | select: none · region · country · primary subject · sector · product · excerpt type | Global News Clippings: region |
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
| `sections` | array, sortable | one group each; nested groups (region > subject) become headings like *Europe: Regulation* or a `subheading` field |
| `sections.heading` | text | |
| `sections.items` | relationship → Articles, Bills, Trademarks (polymorphic), hasMany, ordered | |

**PDF report**: `summary` (richText), `file` (upload → protected PDF collection, same approach as GuideFiles).

**Custom HTML**: `body` as a code field holding sanitized HTML, since these are designed outside the CMS.

### Trademark reports (automated PDF publications)

Two publications are generated, not hand-built. Both use the **PDF report** format.

| Publication | Contents | Schedule |
|---|---|---|
| Weekly US Trademark Report | New trademarks **published for opposition** in the past week | every week |
| Monthly US Trademark Activity | **Cancellations and renewals** in the past month; too large to read in an email, so it's a PDF only | first week of each month |

**Weekly job** (Payload jobs queue on a schedule):

1. Pull the USPTO XML feed for our industry's chapter and upsert Trademark excerpts by `serialNumber` (new filings, renewals, cancellations).
2. Build the weekly PDF from trademarks whose `publishedDate` falls in the past week.
3. In the first week of the month, also build the monthly PDF from trademarks whose `cancelledDate` or `renewedDate` falls in the previous month.
4. For each PDF, create a **draft Issue** on its publication with the PDF as `file` and a short generated `summary` (counts by type).
5. Record the run in TrademarkImportRuns and notify staff that drafts are ready. *Default chosen.*

Staff review each draft, publish it, then press Send as usual. The email carries the summary and a download link, not the report itself. PDFs are rendered from a template in code.

### TrademarkImportRun (`trademark-import-runs`)

A log of each automated pull, so failures are visible.

| Field | Type |
|---|---|
| `startedAt`, `finishedAt` | date |
| `status` | select: running · succeeded · failed |
| `feedSource` | text (feed file or URL) |
| `counts` | group: `new`, `updated`, `renewals`, `cancellations` |
| `issuesCreated` | relationship → Publication Issues, hasMany |
| `error` | textarea |

### Email preferences and Mailchimp sync

Our site is the **source of truth**; Mailchimp only mirrors it.

| Where | Field | Notes |
|---|---|---|
| User | `emailPublications` | relationship → Publications, hasMany; checkboxes on the user's account page |
| Global `mailchimp-settings` | `audienceId`, `publicationsInterestCategoryId` | one audience (*Nicotine360 Publications*), one interest category (*Publications*); API key stays in env |

- **Who can choose:** any user whose access provider has an active Base or Premium plan. Others see no checkboxes, and their choices are treated as empty.
- **Sync rules:** whenever a user's choices, email, name or eligibility changes, a hook upserts the Mailchimp member with every publication interest set to true or false to match our side, so Mailchimp always ends up identical to the site. Eligibility changes include a provider expiring, a plan dropping to None, or a user leaving their provider.
- **Expiry:** a nightly job re-syncs users whose provider expired that day (expiry has no save event to hook on) and does a full reconciliation to fix any drift.
- **No outside sign-ups:** Mailchimp sign-up forms are turned off; changes made in Mailchimp are overwritten on the next sync.
- **Unsubscribes are the one exception.** A Mailchimp webhook (unsubscribe, spam complaint, or address cleaned after bounces) clears that user's `emailPublications` on our side and opens an **EmailFlag** for follow-up, since nearly every case is a mistake or an overzealous firewall. The follow-up process is defined later (likely notifying the relationship manager).
- **Re-subscribing** someone who unsubscribed: Mailchimp generally won't let an API flip them straight back to subscribed; it sends them a confirmation email instead. Current practice, which stays: staff delete the contact in Mailchimp by hand, then press **Re-add** on the EmailFlag, which restores `publicationsBefore` on the user, syncs them back to Mailchimp, and marks the flag resolved.

### EmailFlag (`email-flags`)

A staff queue of unsubscribes and delivery problems to follow up on.

| Field | Type | Notes |
|---|---|---|
| `user` | relationship → Users | ✓ |
| `reason` | select: unsubscribed · spam complaint · cleaned (bounces) | from the webhook |
| `occurredAt` | date | |
| `publicationsBefore` | relationship → Publications, hasMany | what they were receiving, so it can be restored |
| `status` | select: open · following up · resolved | |
| `notes` | textarea | |
| *(action)* | **Re-add** button | restores the user's publications and re-syncs, after staff delete the contact in Mailchimp |

### Sending an issue

The CMS creates and sends the Mailchimp campaign when a staff member presses **Send** on a published issue (with a confirmation dialog).

| Issue field | Type | Notes |
|---|---|---|
| `email.subject` | text | defaults to the issue title |
| `email.previewText` | text | |
| `email.campaignId` | text, read-only | set when the campaign is created |
| `email.status` | select: not sent · sending · sent · failed, read-only | |
| `email.sentAt`, `email.sentBy` | date, relationship → Staff, read-only | |

- **Send** renders the issue into the email template for its format (templates live in code), creates a campaign targeted at the publication's `mailchimp.segmentId`, sets the content and sends it. A **Send test** button sends to a given address first.
- After sending, the issue is locked against re-sending; editing its web version stays possible.

## Services

| Need | Service |
|---|---|
| Hosting + database | Railway (Next.js + Payload app, Postgres) |
| File storage | S3-compatible bucket (existing AWS S3, or Cloudflare R2 if cheaper) via Payload's storage adapter |
| Payments (event tickets) | Stripe (already in use) |
| Account email (verification, password reset, invites) | Mandrill (already in use) |
| Newsletters | Mailchimp; simulated until a test audience exists (campaign rendered to HTML instead of sent) |

## Open questions

1. **Unsubscribe follow-up:** what happens with an EmailFlag (e.g. email the relationship manager), to be defined later.

## Changelog

- 2026-10-08: User `firstName`/`lastName` no longer required at the schema level (the new code-based sign-up flow creates the account before the reader has a profile); added `signup` group (`code`, `codeExpiresAt`, `completedAt`) to track that flow's state. Front end: `/signup` (email → code → profile, with self-serve "create your company" when no Access Provider matches), `/signup/finish` (publication preferences or a contact-us + next-event notice), and a tiered `/dashboard`.
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
