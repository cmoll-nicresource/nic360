# Staff analytics

Open **Analytics** in the admin menu (`/admin/analytics`). Admins and gatekeepers can access it; editors and website users cannot. It uses the existing first-party page-view log, publication delivery summaries and event registrations. Staff page visits are not logged. No third-party chart service, tracker or additional collection is introduced.

## Traffic

Overview, By user, By page and By section share an inclusive date range and daily/weekly/monthly grouping. The default is the last 30 Eastern calendar dates. Ranges may cover up to 366 days. Weeks start Monday; the first/last week or month can be partial. Date/group settings persist when navigating analytics tabs, selecting users and following overview rankings.

Charts compare page views (including signed-out visits) with distinct signed-in users. The same user is counted once per chart period and once for the entire range total; summing the period counts would overcount returning users. Anonymous visits cannot be interpreted as unique people. Average views per day includes quiet days. Missing activity periods are explicitly zero-filled.

Overview includes horizontal rankings for sections, pages and signed-in users. Select a user, exact page or section to see its time series and recent visits. Chart totals aggregate all matching records in PostgreSQL, replacing the earlier 10,000-row dashboard sample. The detailed visit table is limited to the latest 1,000 matching visits and labels that limit. The page selector lists up to 500 known paths; an explicitly selected path is retained even outside that list.

## Publications, events and advertising

Publication charts use sent issues matching publication, issue-date range and title keyword. Recipients/opens/clicks are cumulative issue statistics grouped by the saved calendar issue date, **not** the dates when engagement occurred. Rate charts divide summed opens/clicks by summed recipients in each period (audience-weighted); periods without recipients have no rate. Existing summary cards retain their per-issue average rates, so they can differ from the chart's weighted rate. Tracking methods differ across historical/current providers and automated email opens can affect figures. The inclusive last date is fully included and matching issues are paginated beyond 1,000.

Event charts group currently active registrations by original creation date in Eastern time, split into in-person and virtual tickets, for all events or a selected event. Pending and cancelled registrations are excluded. The chart is not a historical payment/activation/cancellation ledger: a later status change can change earlier counts. The attendance table remains a clearly labeled current all-time snapshot for the latest 24 events.

Advertising includes a horizontal chart of the top individual ads by recorded clicks. Campaign totals remain all-time and are not presented as a fabricated time series. Its existing impressions definition still counts sends containing an ad, not person-level impressions.

## Chart controls and verification

Point to a chart to inspect a period or focus the plot and use Left/Right/Home/End. Legend checkboxes show/hide series. **View chart data** exposes an accessible table of exact values. Charts adapt to smaller screens, support the admin theme and have no animation dependency.

Regression coverage includes Eastern spring/fall daylight-saving boundaries, full inclusive dates, distinct-user grouping, zero periods, Monday/year boundaries, paths/sections/users, parameterized path filters, 10,001 matching visits without truncated chart totals, registration status/event filters, publication weighted rates and missing denominators. PostgreSQL tests use temporary fixtures on an isolated test database; `ANALYTICS_INTEGRATION=1` enables them in CI. Browser tests cover keyboard/legend controls, preserved filters, publication end-date inclusion, event/overview rendering, phone overflow, invalid ranges and editor denial. No live user activity, orders, subscriptions or emails are changed by these tests.
