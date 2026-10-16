# Current project checklist

Updated October 16, 2026. This is the current work list. The original milestones and dated changelog in CLAUDE.md/entity-map.md are history, not an outstanding-task list.

## Completed

- October 16: [excerpt publication selection](./publication-selection.md) corrected: US geography, Global's mixed-location exception, news-only Clippings, published excerpts, issue-date windows and full pagination, with saved-rule repair and regression coverage.
- October 16: [company usage reports](./company-usage-reports.md) for admins/gatekeepers, with provider/date selection, all current users, activity summaries and CSV export.
- October 16: role-specific admin workspace: daily editorial actions and drafts for editors; subscriptions, readers, attendees and orders for gatekeepers. Taxonomy management and staff directory are admin only; existing-term selectors and own-account access remain available. See [staff workspace](./staff-workspace.md).
- Reader design refresh, supplied photography, unified staff workspace under `/admin`, full dataset loading/exports and access checks.
- October 16: article excerpt migration repaired locally and on beta: 8,513 article excerpts/search fields and latest CMS versions restored from the original dump. 823 already matched usable source text; 94 have no distinct original excerpt and are listed for follow-up. See [excerpt recovery](./article-excerpt-recovery.md).
- Trade history restored to beta; report pagination/headers, Nicotine360 branding, linked contents, automatic US trade narrative and CBP TRQ inputs. Yellow editorial placeholders removed. Staff has reported successful report generation. The first-time restore must not be repeated.
- Weekly/monthly trademark PDFs, publication download URLs, published marks in monthly reports and a hard stop for missing weekly Gazette coverage.
- Company/member migration exception decisions applied locally and on beta, with the EmailFlag deletion/retained-suppression repair.
- Queued SES publication delivery, signed unsubscribe, verified/deduplicated SNS feedback, durable per-recipient acceptance, safe retries, metric/version synchronization and controlled beta delivery verification. Mailchimp remains historical only.
- Issue-editor preview of current unsaved content, desktop/mobile widths and protected attached PDF viewing. Refresh after editing; this is a browser approximation of email rendering, not an Outlook/Gmail emulator.
- October 16: excerpt-publication design refreshed across email, editor previews and subscriber web editions using the five supplied references. Full news excerpts/source attribution and legislative status/activity fields are included; weekly legislative editions include recent actions. Branded masthead, linked contents and phone layouts verified. See [newsletter design](./newsletter-delivery.md#publication-design).
- Operations monitoring: admin alert history, staff email digests, failed/stalled newsletters/imports and missing scheduled trademark imports/reports. See [operations](./operations.md).
- Source committed/pushed to GitHub with automated checks. Earlier notes saying the report work is uncommitted are historical.
- October 16: recurring database/upload backups enabled and isolated recovery verified; see [backup and recovery](./backup-recovery.md). Ninety stable tables and all 950 existing upload objects matched. Ten pre-existing missing prototype/sample file entries are documented there.
- October 16: beta event checkout verified with real hosted Stripe sandbox payment and signed completion/expiration deliveries. Exact-cent discounts, pending access, new/existing colleagues, queued invitation acceptance, declines, cancellation, expiration and concurrent signed replays passed. Temporary fixtures removed; beta remains in Stripe test mode and email safe mode. See [event checkout](./event-checkout.md).

## Next work, in priority order

Content follow-up: review the [94 original excerpt gaps](./article-excerpt-source-gaps.json). The bulk migration repair is complete; these need original/source material or editorial decisions.

1. **Human inbox review:** inspect the already-delivered `[TEST] Nicotine360 newsletter delivery verification` email at `cmoll@nicotineresource.org`; review real publication samples in Outlook/Gmail and on mobile. The complaint/bounce simulator notifications are separate messages.
2. **Small staff newsletter pilot:** add an explicit internal recipient selection, preview eligible/excluded audience counts, then deliver to that reviewed staff group. Current global beta safe mode stays on; no migrated audience send is authorized.
3. **Backup operations follow-up:** inspect the next automatic database/upload run, add independent missing-backup notifications, and repeat the recovery drill after significant schema/storage changes. The initial rehearsal and recurring schedules are completed; details and limits are in the backup runbook.
4. **Reader/staff acceptance pass:** walk through signup, verification, reset, membership tiers, report review/publish and event management on beta. Earlier local checks cover much of this; distinguish those from external-user acceptance.
5. **Launch decisions:** domain/cutover, member communications, whether/how to retain old redirects, consent/audience review and deliberate activation of live Stripe credentials/webhooks and reader email. Beta's completed sandbox tests do not enable real payments. Do not turn off safe mode as part of routine testing.

## Operational limits to keep visible

- Monitoring runs within the persistent app. It cannot email when the entire app/database/email service is down; independent uptime monitoring remains a separate follow-up.
- Trade generation is upload/manual-triggered, with no agreed monthly deadline. It does not have a fictitious missing-schedule alarm.
- Missing-report checks cover the automatic weekly trademark workflow and blocked monthly generation recorded in import history. They do not automatically publish or send anything.
- Archived historical placeholder PDFs must be regenerated individually if needed; newer rendering code does not rewrite stored bytes.
- No live Mailchimp sender or report-polling integration is needed.
