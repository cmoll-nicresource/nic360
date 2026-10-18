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

## Connected browsers

Only admins see the Connected browsers sidebar link or can open `/admin/connected-browsers`. The page still lists only the signed-in admin's own connections, with connection IDs, creation/expiry and last-use times. Editors can continue connecting and importing through News Clipper, and all staff can disconnect their own browser in the extension's options. Connections expire after 12 hours; website sign-out alone does not revoke them.

Editors connect from the extension's options through normal website staff sign-in and explicit approval. No endpoint or password is entered in the extension. See [News Clipper](./news-clipper.md) for installation, the one-time 2.2 upgrade, limited credential scope and its separate additive database schema.
