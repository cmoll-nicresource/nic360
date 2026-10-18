# Current project checklist

Updated October 17, 2026. This is the current work list. The original milestones and dated changelog in CLAUDE.md/entity-map.md are history, not an outstanding-task list.

## Completed

- October 17: issue editor simplified: Build from rules is available below Format as soon as Excerpt list is selected, before the first save. It builds into the current form and preserves other unsaved edits; staff review and save explicitly. The Email administrative group is hidden, and delivery counts use a read-only card summary. Regression coverage checks first-save persistence, unsaved dates/format/title, retained email metadata and unchanged delivery counters. See [publication selection](./publication-selection.md).

- October 17: user signup and migration password recovery reviewed, with explicit previous-site guidance, an account Change password link, recoverable reset-request errors and an eight-character reset minimum. Added migrated-profile/company/preference preservation, expired/replaced reset links, session invalidation, suspension and unmatched-company signup regressions. See [account onboarding and launch plan](./account-onboarding.md); user-wide reset/announcement sending and email-safe-mode changes require a separate rollout decision.

- October 17: [News Clipper 2.2](./news-clipper.md) deployed to beta and packaged separately for Chrome. Editors connect through website staff sign-in and approval, with device-only, revocable 12-hour clipper credentials. Metadata extraction includes title, original social preview, publication date and reviewed existing locations; subject/product indexing and publishing remain manual. All GitHub checks and a real unpacked-Chrome beta sign-in/import/revocation test passed; temporary fixtures and SSH access were removed. Existing installations need the documented one-time reinstall; deploying the website does not update Chrome.

- October 16: durable production-build/browser CI, account lifecycle and endpoint permissions tests, publication configuration/migrated taxonomy contracts, synthetic trade database checks, coverage reporting/floors, accessibility, cross-browser email screenshots, bounded load and synthetic backup/recovery smoke. See [testing](./testing.md). Tests also exposed and closed signup-completion, suspension and direct-draft access gaps.

- October 16: [excerpt publication selection](./publication-selection.md) corrected: US geography, Global's mixed-location exception, news-only Clippings, published excerpts, issue-date windows and full pagination, with saved-rule repair and regression coverage.
- October 16: [company usage reports](./company-usage-reports.md) for admins/gatekeepers, with provider/date selection, all current users, activity summaries and CSV export.
- October 16: role-specific admin workspace: daily editorial actions and drafts for editors; subscriptions, users, attendees and orders for gatekeepers. Taxonomy management and staff directory are admin only; existing-term selectors and own-account access remain available. See [staff workspace](./staff-workspace.md).
- User design refresh, supplied photography, unified staff workspace under `/admin`, full dataset loading/exports and access checks.
- October 16: article excerpt migration repaired locally and on beta: 8,513 article excerpts/search fields and latest CMS versions restored from the original dump. 823 already matched usable source text; 94 have no distinct original excerpt and are listed for follow-up. See [excerpt recovery](./article-excerpt-recovery.md).
- Trade history restored to beta; report pagination/headers, Nicotine360 branding, linked contents, automatic US trade narrative and CBP TRQ inputs. Yellow editorial placeholders removed. Staff has reported successful report generation. The first-time restore must not be repeated.
- Weekly/monthly trademark PDFs, publication download URLs, published marks in monthly reports and a hard stop for missing weekly Gazette coverage.
- Company/subscription migration exception decisions applied locally and on beta, with the EmailFlag deletion/retained-suppression repair.
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
3. **Backup content follow-up:** resolve the ten pre-existing missing prototype/sample attachment records. Independent six-hour freshness checks, a daily read-only logical archive, an encrypted missing-heartbeat alarm and weekly/manual isolated restores are now provisioned. The SNS alert subscription is confirmed and a controlled verification was accepted by AWS. The fresh archive matched 90 stable tables and all 950 existing objects; the strict content audit remains red on those ten gaps. See the backup runbook.
4. **User/staff acceptance pass:** walk through signup, verification, reset, subscription tiers, report review/publish and event management on beta. Earlier local checks cover much of this; distinguish those from external-user acceptance.
5. **Launch decisions:** domain/cutover, user communications, whether/how to retain old redirects, consent/audience review and deliberate activation of live Stripe credentials/webhooks and user email. Beta's completed sandbox tests do not enable real payments. Do not turn off safe mode as part of routine testing.

## Operational limits to keep visible

- Monitoring runs within the persistent app. It cannot email when the entire app/database/email service is down; independent uptime monitoring remains a separate follow-up.
- Trade generation is upload/manual-triggered, with no agreed monthly deadline. It does not have a fictitious missing-schedule alarm.
- Missing-report checks cover the automatic weekly trademark workflow and blocked monthly generation recorded in import history. They do not automatically publish or send anything.
- Archived historical placeholder PDFs must be regenerated individually if needed; newer rendering code does not rewrite stored bytes.
- No live Mailchimp sender or report-polling integration is needed.
