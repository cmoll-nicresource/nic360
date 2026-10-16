# Operational alerts

The persistent Payload app checks operations every five minutes using the `operations` queue. Staff can open **Operational alerts** from the admin workspace or System collections. Reader accounts cannot read or mutate alert records. Alerts and notifications never use the subscriber audience.

## Checks

- Event order checkout/activation errors and failed queued colleague invitations link to the affected order for staff review.

- Failed newsletter issues; sends older than ten minutes only when the sending worker's advisory lock is free. Large sends with an active worker are not falsely considered stalled.
- Failed trade/trademark import runs and imports running longer than two hours. A newer run for the same Gazette/upload supersedes older attempts.
- Successful imports with a recorded report-generation error, including monthly trademark reports blocked by missing coverage.
- Friday's scheduled USPTO import has until 16:00 UTC (four hours after its scheduled start) to produce a successful official-feed run for the coming Tuesday Gazette.
- A successful scheduled import with reportable activity must have a weekly PDF issue for that Gazette date. An empty class-34 issue does not require an empty PDF. Regenerating a missing weekly report manually satisfies the check.

Monitoring does not invent schedules for manually generated trade reports. It does not publish, retry imports, recover sends or resend newsletter messages automatically.

## Notification behavior

Each condition has a durable unique key. The scanner holds a database advisory lock across detection and notification, preventing duplicate digests from overlapping app instances. New conditions appear in admin and are grouped into a digest of up to twenty alerts per check. Once accepted by the email transport, that alert is not emailed repeatedly. Cleared conditions are marked resolved; a recurrence reopens and notifies again. Notification failures stay visible and retry no sooner than one hour. A crash between mail acceptance and recording acceptance can still yield a later duplicate alert; this is an operational notification, not an exactly-once mail guarantee.

Email uses the existing safe-mode-wrapped account transport and `OPERATIONS_ALERT_EMAIL`, never publication subscriptions. Beta safe mode still redirects to its configured safe mailbox. Do not disable safe mode for alerts. Email contains admin links; login is still required.

For an import that succeeded but recorded a blocked monthly report, complete missing Gazette coverage, regenerate that monthly report and clear the run's obsolete error after reviewing the result (or rerun the original first-week import successfully). The historical warning stays open until that record is corrected/superseded. Failure alerts should be investigated through their source links rather than deleted.

## Setup

Before deploying to an existing database:

```sh
pnpm exec tsx migration/prepareOperationalAlerts.ts
pnpm exec tsx migration/prepareOperationalAlerts.ts --apply
```

The additive, repeatable migration creates the alert table, lock relation and job enum entries. It does not change existing content, preferences or jobs. Configure:

```sh
OPERATIONS_MONITOR_ENABLED=true
OPERATIONS_MONITOR_SINCE=2026-10-15T00:00:00.000Z # use actual activation time
OPERATIONS_ALERT_EMAIL=cmoll@nicotineresource.org
```

Use the actual enablement timestamp to avoid flooding staff with old migration/test failures. Local monitoring is off by default. An invalid activation timestamp or missing staff address fails the monitor job visibly rather than silently choosing a recipient.

Monitoring itself depends on the app, database and mail service. It cannot report a total outage from inside that outage. Independent uptime alerts and backup recovery verification remain on [the project checklist](./project-status.md).
