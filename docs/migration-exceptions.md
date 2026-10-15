# Migration exception review

Reviewed October 15, 2026 against the local database and Railway beta. The historical notes in the entity-map changelog describe the original migration; this file records the current disposition.

## Completed

- **BAT / Reynolds:** the earlier approval to group Reynolds readers under British American Tobacco had left four readers assigned to four domainless legacy Reynolds providers. Reassigned those readers to BAT (provider 102), which already has Premium/live access without an expiry. BAT now has 117 readers. Kept the source provider records, existing publication preferences and all other account fields. Applied and verified locally and on beta. Before-change provider/reader snapshots are retained under ignored `migration/data/`; they are not part of Git history.
- **Subscription audit:** compared current assignments with the original staff-provided list, then applied the October 15 staff decisions below in both environments. No Base/Premium provider has an expired licence or a non-live status in either environment. Reader counts include all linked accounts; they do not prove activity, verification, or email consent.
- **EmailFlag deletion:** the required `user` relationship conflicted with PostgreSQL's `ON DELETE SET NULL` constraint. It is now nullable, while new flags still require an existing reader through validation. `recipientEmail` records the delivery address and is retained after deletion. Suppression includes both retained and current addresses for open/following-up flags, across all result pages. Resolved flags no longer suppress. Re-add returns 409 for a deleted reader or an already resolved flag. Staff can still review and resolve historical flags.

## Confirmed membership decisions

Staff confirmed the company consolidations and no-access decisions on October 15. Pillar and Republic use the original membership list's standard Base tier; Citigroup retains its existing Premium tier. Applied and verified in both databases. No publication email preferences were added or restored.

| Membership-list name | Canonical CMS record | Beta readers | Final tier | Resolution |
|---|---|---:|---|---|
| KS BAT RAI Services Company | British American Tobacco (102) | 117 | Premium | Completed the previously approved BAT/Reynolds grouping; retained the now-empty Reynolds records for history |
| Pillar HC | Pillar Clinical Research (322) | 2 | Base | Confirmed same member; applied membership to this existing record, with no separate Pillar HC record to delete |
| Republic Brands | DRL Enterprises, Inc. (332), domains `drl-ent.com`, `rpbtob.com` | 7 | Base | Confirmed membership belongs under DRL; no separate Republic Brands record existed |
| Citi / Citi Research | Citigroup Global Markets Inc. (230) | 1 | Premium | Consolidated the two empty, domainless Citi providers (226, 273) into the existing Global Markets account and removed the duplicates |
| PT Djarum | PT Djarum (344), domain `djarum.com` | 5 | None | Explicitly confirmed no access; retained the existing company and readers |
| Cigar Rights of America | No provider | 0 | None | Explicitly confirmed no access; no provider or enrollment domain created |
| JUUL Labs | JUUL Labs (349) | 5 | None | Explicitly confirmed no access on beta; aligned the local record to that decision |
| Internal NRC account | Nicotine Resource Consortium (350) | 1 | Premium on beta | Preserved as an internal account, separate from customer membership assignments |

Do not rerun `migration/applyMemberPlans.ts` as an exception-resolution tool. It represents the original list and resets every unlisted provider to None; it would overwrite later approved decisions, including the internal account. Do not rerun the broad duplicate-provider merger to resolve this list: shared domains and similar names are review evidence, not blanket merger authority.

## Schema update and verification

Before deploying the new EmailFlag code to an existing database, run:

```sh
pnpm exec tsx migration/fixEmailFlagRelationship.ts          # rolled-back preview
pnpm exec tsx migration/fixEmailFlagRelationship.ts --apply  # transactionally apply
```

The migration adds `recipient_email`, backfills it from linked readers, checks that every existing flag has an address, then removes `user_id`'s NOT NULL constraint. It preserves the SET NULL foreign key and every flag. A failed check rolls back the transaction. No Payload initialization or unrelated schema reconciliation occurs. Applied locally and on beta October 15; both had zero flags at the time.

`migration/resolveBatReynolds.ts` similarly defaults to a rolled-back preview. `--apply` checks the exact reviewed provider identities and subscription state, saves a recovery snapshot before changing any reader, and reassigns the residual Reynolds readers. It does not delete provider records or send mail. Repeating it after the correction moves zero readers.

`migration/resolveReviewedMemberships.ts` applies the October 15 staff decisions with the same preview/apply pattern, exact provider-name and subscription checks, and a recovery snapshot. It refuses unexpected domain-bearing Citi source records instead of silently discarding enrollment rules. Duplicate removal and plan updates share one transaction. A second preview after applying makes no changes. Both local and beta recovery snapshots are retained in the ignored `migration/data/` directory.

Regression coverage includes a PostgreSQL TEMP-table test that starts with the broken FK/NOT NULL combination, backfills existing flags, deletes one reader, verifies retained history and repeats the migration. Unit tests cover snapshot integrity, deleted-reader follow-up, suppression pagination, following-up flags and re-add refusals. A separate local Payload check exercised creation, deletion, retained suppression and resolution with a temporary reader/flag, verification email disabled, and fixture cleanup. CI runs the PostgreSQL regression alongside atomic dataset imports.
