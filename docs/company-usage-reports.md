# Company usage reports

Admins and gatekeepers can open **Company usage reports** from the Analytics section of `/admin`, or visit `/admin/company-reports`.

Choose a company/access provider and an inclusive start/end date. Dates and activity timestamps use Eastern time, including daylight saving transitions. The default period is the current month through today.

The report includes every user currently assigned to that provider, including suspended accounts and users with no recorded activity. Each row shows name/email, account status, page views, active calendar days, distinct pages, first/last activity in the period, section totals and the five most-viewed paths. Summary cards show users, active users and total views. Download CSV exports the same report with one row per user.

Usage means signed-in website page views recorded by the existing first-party tracker. It does not include staff or anonymous visits, email engagement, time spent or proof that content was read. A zero indicates no recorded views, not necessarily no use of emailed publications. Earlier traffic that was never recorded cannot be reconstructed.

The report roster is based on the user's **current** provider. Historical provider assignment changes are not stored; selecting an older range does not reconstruct the company's past roster. Users without a current provider are excluded.

The report aggregates the full matching Postgres history and does not inherit the prototype analytics dashboard's 10,000-view limit. It makes no changes to subscriptions, users or analytics. No schema migration is required.

The screen and CSV endpoint require gatekeeper/admin access; editors, users and anonymous users cannot obtain reports. CSV responses are private and uncached, with spreadsheet formula escaping. Tests cover input validation, authorization, CSV safety, provider isolation, zero activity, full history and both daylight saving boundaries. Postgres checks use isolated temporary tables and run in CI.
