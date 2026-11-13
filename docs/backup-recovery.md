# Backup and recovery

## November 12 retirement of missing demo uploads

Staff approved retiring the ten historical demo uploads listed below. A foreign-key audit found their stale links in current guide thumbnails, dataset sample-import metadata, speaker headshots, sponsor logos and old guide versions. The real current guides already referenced PDFs 24–28; those files and guides were preserved.

The guarded routine in `migration/retireMissingDemoUploads.cjs` removed media 83–91, PDF 13 and five obsolete non-latest guide versions containing that demo PDF. It cleared the placeholder links on five current guides and their five latest versions, two datasets, five speakers and three sponsors. It did not delete current guides, dataset rows, speakers, sponsors or any stored objects. A checksum-protected private rollback snapshot is retained in ignored `migration/data`; every surviving field was checked against the snapshot, allowing only the approved link changes. The temporary SSH key was revoked immediately after verification.

PostgreSQL regression tests cover exact asset identity, unexpected references, stale previews, preservation of real PDFs/content and rollback after a failed delete. This is an exact one-time retirement, not a generic orphan-file cleanup. Fresh backups and a strict real-archive recovery rehearsal are required after the change; the audit must not ignore missing attachments.

## November 12 PostgreSQL compatibility repair

CI's floating `postgres:18` source image advanced to 18.7 while the logical-backup client and isolated restore server were pinned to 18.6. A dump of the newer source made by the older client included `pg_attver` column metadata that the older restore server rejected. The failing restore exited before publishing recovery evidence; it did not affect the running beta database.

Backup tools, isolated restore and both CI database services now use PostgreSQL 18.7 at the same immutable image digest, defined for the restore runner in `ops/backups/postgres-image.mjs`. `postgres-image.test.mjs` enforces matching pins and rejects floating source tags. Update the shared module, backup Dockerfile and both workflow service pins together when adopting a new release. Do not remove archive SQL or ignore restore errors to work around incompatibility.

Local isolated rehearsals recovered a 50-table synthetic PostgreSQL 18.7 database using archives exported by both the previous 18.6 backup client and the updated 18.7 client. Stable-table fingerprints and the synthetic uploaded file matched in each case; restore containers had networking disabled and were removed. This verifies archive compatibility, not the completeness of customer attachments. A real-archive rehearsal must still pass the strict attachment audit before recording a successful recovery marker.

Verified October 16, 2026 against Railway beta (`beta.nicotine360.org`). Railway calls the environment `production`; it is still the beta site. Never point a rehearsal restore at that database, its volume, or the live R2 bucket.

## Protection now configured

| Data | Backup | Schedule (UTC) | Retention |
|---|---|---|---|
| PostgreSQL, including Payload and `ref`/`trade`/`report` | Railway native volume snapshots | Daily 17:33; Saturday 09:47; monthly on the 1st at 00:15 | API reports 6 days daily, 27 days weekly, 89 days monthly |
| All uploaded files in R2 `nic360-media` | Independent private AWS S3 snapshots, via the Railway `upload-backups` cron service | Daily 08:00 (04:00 New York during daylight time; 03:00 in standard time) | 45 days; overwritten noncurrent versions expire after 7 days |
| Rehearsal database export and evidence | Private S3 `database-rehearsals/2026-10-16/` | One-time recovery landmark, not a scheduled logical-export job | 90 days |

Before this work, Railway had **no backup schedules**, only the October 15 volume-resize snapshot. R2 provides no S3 versioning interface; copying a bucket with deletions propagated would not preserve deleted files. The new job instead creates a fresh dated prefix each run, never writes/deletes at the source, and never deletes at the destination. A full cross-provider download comparison must pass before `complete.json` is published. The manifest describes the copied snapshot, so a source replacement during copying cannot leave a stale pre-copy manifest labeled complete.

The independent bucket is `nic360-backups-226541720866-us-east-1` in AWS account `226541720866`, region `us-east-1`. It has all four public-access blocks enabled, SSE-S3/AES256 encryption, versioning and a TLS-only bucket policy. The dedicated writer can list the bucket and read/write `uploads/*`; policy simulation confirms **DeleteObject and DeleteObjectVersion are denied**. It has no access to the separate database export prefix. Lifecycle policy performs expiry, rather than granting deletion to the job. Source credentials stay as Railway references to the existing app variables, not copies in Git or local secret files. A separate read-only R2 credential would further narrow the cron service's source privileges when Cloudflare token administration is available.

The pinned image and non-secret service configuration are in [service-config.json](../ops/backups/service-config.json). The deployed script is the base64 encoding of [uploads.sh](../ops/backups/uploads.sh) in `BACKUP_SCRIPT_B64`. Editing the repository script alone does **not** update that variable: replace it from the reviewed file and redeploy the backup service. Do not change the app's storage settings to the backup bucket.

## Rehearsal evidence

- Created native Railway snapshot `8a9fb231-53d0-466b-86a6-ec36ad103e8c` (`recovery-rehearsal-20261016`). Confirmed present through the backup API. This manual snapshot has no expiry; review/remove it deliberately after future rehearsals rather than relying on it as the daily policy.
- Exported a current PostgreSQL custom archive through private SSH; archive size **39,674,141 bytes**, SHA-256 **`ba79237aa792d668ae5639e827844db31bf3b707c70ede3060db05c650f1716c`**. Uploaded it privately to AWS and downloaded it again; the round-trip hash matched.
- Restored that archive with PostgreSQL 18, `--exit-on-error --single-transaction --no-owner --no-privileges`, into a **new Docker container with networking disabled and no published ports**. Restore plus fingerprint generation took **14 seconds**; this is not a promise of full service recovery time.
- Compared every row, via ordered complete-row fingerprints, across **90 stable public/ref/trade/report tables**. All row counts and hashes matched beta. That includes 9,430 articles, 3,116 publication issues, 627 users, 951 media records and 9 PDF-file records. Queue, locks/sessions, page views and live telemetry were excluded from the comparison because they change while a logical export is being taken; they were still included in the full archive.
- Upload snapshot `uploads/20261016T120930Z/` passed full cross-provider comparison: **950 files, 53,235,638 bytes, zero differences**. Downloaded every object into an isolated ignored folder; every file passed presence, byte-size and source-MD5 verification. The reusable verifier rejects path traversal, symlinks escaping the restore root, missing files, truncation and same-size corruption.
- The final deployed script was exercised again: snapshot `uploads/20261016T121636Z/` also reported 950 matching files and zero differences. All locally recovered bytes passed verification against this second manifest as well.
- No application process was started against the recovered data, so no jobs, user emails, imports or payment integrations could run. No app database URL or storage configuration was changed.

The tested database path is the **logical archive**, not a native in-place volume rollback. Native snapshots were created/configured/inspected; beta was never rolled back to prove them. Railway documents volume restore as an in-place operation, including removal of newer backups, so do not use it for a casual rehearsal. For a future native/PITR rehearsal, first establish a provider-supported separate destination; do not restore to beta. [Railway backup/restore guide](https://docs.railway.com/guides/postgres-backups-restores).

### Historical missing prototype assets (retired November 12)

The earlier rehearsals found ten CMS records referencing files already absent from R2. They were not deleted by backup or restore. Staff approved their retirement on November 12 as recorded above:

- Media 83, 86–91: one-pixel trademark/guide/ad/headshot/sponsor placeholder PNGs.
- Media 84: `international-tax-rates-5.csv`; media 85: `cigarette-market-share-by-company-5.csv` (old sample CSV uploads).
- PDF file 13: `nic360-guide-placeholder-5.pdf` (239-byte prototype placeholder).

All 950 objects actually present in the live bucket were protected and recovered. Keep these ten historical missing entries separate from a new backup failure; replacing/removing them is a content-cleanup decision, not part of restoring data.

## Repeat the checks

Use explicit Railway project/environment/service IDs from `service-config.json`. Database service is `d806fbf7-26ed-478e-b6dc-9a85c27f41c4`.

```sh
railway postgres pitr schedule list --project PROJECT --environment ENV --service DATABASE --json
railway postgres pitr backup list --project PROJECT --environment ENV --service DATABASE --json
railway cron list --project PROJECT --environment ENV --service upload-backups --json
railway cron run --project PROJECT --environment ENV --service upload-backups --yes --json
```

Select only a dated S3 prefix with a `complete.json` marker. Download its manifest and objects into a new private directory, then run:

```sh
aws s3 cp s3://BACKUP_BUCKET/uploads/TIMESTAMP/manifest.json recovery/manifest.json
aws s3 sync s3://BACKUP_BUCKET/uploads/TIMESTAMP/objects/ recovery/uploads/ --only-show-errors
node ops/backups/verify-uploads.mjs recovery/uploads recovery/manifest.json
```

For database recovery, obtain the archive and recorded SHA-256 before restoring. Start an empty PostgreSQL 18 instance, disable outbound connectivity, and keep all application jobs/providers off. Run `pg_restore` in a single transaction **without `--clean`** against that empty destination. Use [database-fingerprints.sql](../ops/backups/database-fingerprints.sql) for read-only content comparisons; fingerprints of traffic/queue tables will legitimately differ after the source continues running. A matching archive plus matching stable-table fingerprints and recovered file checksums is the acceptance condition. Destroy the temporary container and its temporary volume afterwards; never delete the working local Postgres container or a beta volume.

## Limits and operating costs

### Repeatable verification added October 16

The repository includes a separate PostgreSQL/rclone [logical backup worker](../ops/backups/Dockerfile). It exports the database and stable-table fingerprints from the **same MVCC snapshot**, writes archive/fingerprint SHA-256 sums, and publishes a completion marker only after the archive is uploaded. Its destination is `database-daily/`, via a dedicated scheduled Railway service and destination write policy. It has no application process, mail transport or payment integration.

[rehearse.mjs](../ops/backups/rehearse.mjs) downloads completed backups, verifies SHA-256, restores PostgreSQL 18 with `--network none`, compares every stable table, recovers upload bytes and checks manifest hashes plus CMS attachment references. It removes its disposable container/volume and private temporary files. A local synthetic execution passed with 85 stable tables and three PDF attachments. CI runs that round trip on every push without cloud access.

[health.mjs](../ops/backups/health.mjs) rejects upload/database markers older than 30 hours and recovery evidence older than eight days. The [independent workflow](../.github/workflows/recovery.yml) is enabled outside the app every six hours, with a Sunday/manual full rehearsal. AWS role `nic360-github-recovery` is restricted to this repository's immutable owner/repository IDs and master branch, read-only backup access, recovery-evidence writes, a scoped CloudWatch heartbeat and alerts only to `cmoll@nicotineresource.org`. Missing heartbeat alarms provide a second check on the scheduler itself; CloudWatch's extra lookback can delay detecting missing samples beyond one six-hour period. Identical SES failure alerts repeat at most daily; a changed condition alerts immediately. The SNS heartbeat subscription requires recipient confirmation.

The approved daily logical service is now provisioned at **07:00 UTC**, using `nic360_backup` (`pg_read_all_data`, default read-only transactions, five-minute statement timeout). Its first completed archive is `database-daily/20261017T033253Z` (UTC naming; October 16 in New York). [Service configuration](../ops/backups/database-service-config.json), [destination writer policy](../ops/backups/database-writer-policy.json), [recovery policy](../ops/backups/recovery-policy.json), and [alarm configuration](../ops/backups/alert-config.json) contain no secrets. Simulation denies the writer's `DeleteObject` and the recovery role's archive writes/deletes. Retention additions affect only new `database-daily/` (45 days) and `verification/` (90 days) prefixes; existing rules were preserved. The image carries a trusted CA bundle so S3 TLS certificate validation stays enabled.

At today's small beta data volume, budget roughly **$2/month** for offsite archive storage/requests, the encrypted alarm and brief backup jobs. The current Railway workspace is **Pro**, with a $20/month minimum including $20 usage; observed usage projects to about $7/month but the plan minimum governs. A practical beta-stack budget is **$22–25/month**, excluding existing unrelated AWS workloads, domain/development subscriptions, payment fees and audience email volume. SES base outbound sending is $0.10 per 1,000 messages plus data charges. These are early estimates, not a fixed bill. Recheck after sustained traffic or data growth.

The restore check deliberately fails on missing attachment references, including the ten pre-existing prototype/sample records listed above. No blanket missing-file exception list was introduced. Resolve those source content defects or explicitly review a narrowly scoped exception before claiming a fully healthy recovery. The old rehearsal evidence remains valid for the bytes actually present; it does not recreate absent originals.

A fresh real-archive rehearsal on October 16 matched **all 90 stable tables and all 950 uploaded objects**. The strict attachment audit identified exactly the same ten historical prototype/sample gaps; it remained failed rather than publishing a healthy recovery marker. The recovered PostgreSQL container had networking disabled and was removed with its volume; downloaded files were deleted. A socket-only temporary PostgreSQL initialization server exposed a readiness race in the first GitHub attempt; the runner now waits for the final TCP server before creating/restoring the target. GitHub OIDC authentication and encrypted CloudWatch-to-SNS publication were verified separately. The recipient confirmed the SNS subscription on October 16; AWS returned an active subscription ARN, and accepted a controlled verification publication (message `372efd3f-5aed-50a1-9401-9e73a9a4a99d`). This verifies provider acceptance, not inbox receipt.

Database and object storage are separate systems, so their scheduled snapshots are not a single atomic recovery point. Inspect file references when pairing recovery dates; if uploads changed between backups, combine the appropriate retained file snapshots instead of silently accepting missing attachments. Daily scheduling targets roughly a day's recovery-point gap, not point-in-time recovery. Enabling database PITR would be a separate infrastructure change.

Railway's October 16 daily database snapshot at 17:33 UTC was confirmed through the API. The upload and logical-export jobs have been manually exercised; continue checking scheduled results. A failed job must not publish a completion marker. Independent freshness checks and the missing-heartbeat alarm now cover these backup jobs even when the app is unavailable; the app's own operational monitor still cannot report its own total outage.

Costs include Railway snapshot storage, brief cron CPU/memory, R2 reads and AWS storage/PUT/GET requests. At the measured unchanged upload size, 45 complete copies are about **2.4 GB** before versions/metadata; charges grow with uploaded data. No public endpoint or always-running backup server was added. See [AWS S3 pricing](https://aws.amazon.com/s3/pricing/) for current rates. Consider scoped CloudTrail data events, encrypted access-log destinations and request metrics if stronger backup access auditing is needed; these add request/logging costs. [AWS storage security guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html), [R2 S3 feature compatibility](https://developers.cloudflare.com/r2/api/s3/api/).
