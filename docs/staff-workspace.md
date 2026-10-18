# Staff workspace

Updated October 18, 2026. `/admin` presents daily work according to the signed-in staff role.

| Role | Daily actions | Secondary work |
| --- | --- | --- |
| Editor | Add news excerpts, add legislation, create publication issues | Drafts, content libraries, publication definitions, reports and imports |
| Gatekeeper | Manage subscriptions, register readers, register attendees, review orders | Reader accounts, access checks, email follow-up and event attendance |
| Admin | Both workflows | Staff accounts, taxonomy and reference data, analytics and administration |

Gatekeepers do not see editorial dashboard data, task links or navigation. Their existing inherited editorial permissions remain in place; this is a workspace visibility change. Event management puts attendees first and hides program-editing sections for gatekeepers.

Only admins can open taxonomy management screens or create, update or delete sectors, products, subjects, locations, sources and countries. Editors can still read and select existing terms in content forms. Public taxonomy lookups used by reader filters remain available.

Only admins can browse and manage staff accounts. Other staff retain access to their own account profile, without permission to change their role or manage other staff.

Legacy Id fields on issues and subjects are readable and editable only by admins, including through the API. Existing migration identifiers are retained.

The collection visibility wrapper composes existing collection visibility rules. The admin route explicitly rejects authenticated non-admin access to taxonomy and staff collection screens. Collection access rules independently protect writes and staff records through the API.

The role-specific workspace change requires no database migration. Automated checks cover role-specific tasks and dashboard queries, taxonomy permissions, staff self-access and collection visibility.

## Grouped menu

The sidebar replaces Payload's automatic collection list with News, Bills, Publications, Guides, Data, Taxonomy, Users, Events, Analytics and Admin, in that order. Sections follow the same role restrictions as the daily workspace: gatekeepers see member operations, events and analytics; editors see editorial sections and event programs; admins see everything. The native mobile menu, account controls, logout and form navigation protection remain available.

Find/Create a publication opens **issues**. Publication settings remains a separate link for recurring titles and rules. Newsletter Deliveries is now labeled **Publication Deliveries**; its collection/API slug remains `newsletter-deliveries`. Guides are loaded from the actual guide records, including drafts, and link directly to their edit screens. All guides remains available for creating and finding resources.

Article, bill and publication issue lists default to newest first by source date, bill date and issue date respectively. Staff can still choose another sort; Payload retains individual saved list preferences.

Events links are selected from actual records: the most recently completed event, the next upcoming event, and any event underway. The sidebar and Past events list use the staff calendar in America/New_York; each event dashboard formats its dates and countdown in the event's own timezone. Create new event is editorial/admin work; gatekeepers continue using attendee operations. Past events is filtered and paginated, and All events keeps the full archive reachable.

Additional links preserve existing workflows: Publication settings, All guides/events, reader access checks, Email follow-up, Company usage, Connected browsers and Media library. There is no separate duplicate collection menu below these groups.

## Event dashboards

`/admin/events/{id}/manage` is the dashboard for an individual event. It includes settings, a status/date banner, calendar days remaining, and program counts. Admins and gatekeepers also see an exact active registration count, excluding pending and cancelled registrations. Editors do not receive attendee personal information.

Program sections list the event's attached speakers/sponsors with direct edit links, plus create/attach/remove controls. Profiles are shared across events, so profile edits affect every event using that record. Agenda sessions include drafts, can be created in the dashboard, and link to their full edit screen; Browse all agenda sessions remains scoped to the event.

Attendee operations include name/email/ticket filtering, direct registration edits, a full event-filtered registration list, full-directory reader search, registration of new readers, discounts, ticket settings and attendance reports. The inline registration list shows at most the latest 500 records, with an explicit link to search the complete list; the headline active count is not capped. Gatekeepers see these operational sections first, with program editing hidden. Existing registration actions and account emails use the existing permissions and safe-mode transport.

Analytics → Events summarizes active in-person/virtual registrations for the latest 24 events and links to each event's complete dashboard and report. Older events remain accessible in the paginated event archive.

## Connected browsers

Only admins see the Connected browsers sidebar link or can open `/admin/connected-browsers`. The page still lists only the signed-in admin's own connections, with connection IDs, creation/expiry and last-use times. Editors can continue connecting and importing through News Clipper, and all staff can disconnect their own browser in the extension's options. Connections expire after 12 hours; website sign-out alone does not revoke them.

Editors connect from the extension's options through normal website staff sign-in and explicit approval. No endpoint or password is entered in the extension. See [News Clipper](./news-clipper.md) for installation, the one-time 2.2 upgrade, limited credential scope and its separate additive database schema.
