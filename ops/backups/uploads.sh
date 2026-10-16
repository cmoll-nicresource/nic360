#!/bin/sh
# Daily append-only snapshot. Source writes/deletes and mirror-style deletes are never used.
set -eu
: "${UPLOAD_SOURCE_BUCKET:?Missing source bucket}"
: "${UPLOAD_BACKUP_BUCKET:?Missing destination bucket}"
[ "$UPLOAD_SOURCE_BUCKET" != "$UPLOAD_BACKUP_BUCKET" ] || exit 2
stamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="archive:${UPLOAD_BACKUP_BUCKET}/uploads/${stamp}"
manifest=$(mktemp)
trap 'rm -f "$manifest"' EXIT
rclone copy "r2:${UPLOAD_SOURCE_BUCKET}" "${destination}/objects" --transfers 4 --checkers 8 --retries 3 --stats-one-line --stats 30s
# Download and compare all bytes across providers before publishing a completion marker.
rclone check "r2:${UPLOAD_SOURCE_BUCKET}" "${destination}/objects" --download --checkers 4
# Fingerprint the copied snapshot, not an earlier source listing that could
# become stale if a file was replaced during the transfer.
rclone lsjson "${destination}/objects" --recursive --hash > "$manifest"
rclone copyto "$manifest" "${destination}/manifest.json"
printf '{"completedAt":"%s","sourceBucket":"%s","snapshot":"uploads/%s","verification":"rclone check --download"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$UPLOAD_SOURCE_BUCKET" "$stamp" | rclone rcat "${destination}/complete.json"
echo "Upload backup completed and verified: uploads/${stamp}"
