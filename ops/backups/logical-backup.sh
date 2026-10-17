#!/bin/sh
# No application process runs here. Archive and fingerprints share the same MVCC snapshot.
set -eu
umask 077
if [ -n "${BACKUP_DATABASE_URL:-}" ]; then
  set -- --dbname="$BACKUP_DATABASE_URL"
else
  : "${PGHOST:?Missing private host}" "${PGDATABASE:?Missing database}" "${PGUSER:?Missing read-only user}" "${PGPASSWORD:?Missing backup password}"
  set --
fi
: "${UPLOAD_BACKUP_BUCKET:?Missing backup bucket}"
export PGOPTIONS='-c default_transaction_read_only=on'
work=$(mktemp -d)
keeper=''
cleanup() {
  [ -z "$keeper" ] || kill "$keeper" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT INT TERM
sed '/^BEGIN READ ONLY;$/d; /^COMMIT;$/d' /ops/database-fingerprints.sql > "$work/fingerprint-query.sql"
mkfifo "$work/control"
psql "$@" -X -v ON_ERROR_STOP=1 < "$work/control" > "$work/session.log" 2>&1 &
keeper=$!
exec 3> "$work/control"
cat >&3 <<SQL
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
\pset tuples_only on
\pset format unaligned
SELECT pg_export_snapshot() \g $work/snapshot
\o $work/fingerprints.jsonl
\i $work/fingerprint-query.sql
\o $work/ready
\qecho ready
\o
SQL
attempt=0
while [ ! -s "$work/ready" ]; do
  kill -0 "$keeper" 2>/dev/null || { echo 'Snapshot session failed'; tail -n 8 "$work/session.log"; exit 1; }
  attempt=$((attempt + 1))
  [ "$attempt" -lt 180 ] || { echo 'Snapshot session timed out'; exit 1; }
  sleep 1
done
snapshot=$(tr -d '[:space:]' < "$work/snapshot")
pg_dump "$@" --format=custom --no-owner --no-privileges --snapshot="$snapshot" --file="$work/database.dump"
printf 'ROLLBACK;\n\\q\n' >&3
exec 3>&-
wait "$keeper"
keeper=''
pg_restore --list "$work/database.dump" > /dev/null
stamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="archive:${UPLOAD_BACKUP_BUCKET}/database-daily/${stamp}"
(cd "$work" && sha256sum database.dump fingerprints.jsonl > SHA256SUMS)
for name in database.dump fingerprints.jsonl SHA256SUMS; do
  rclone copyto "$work/$name" "$destination/$name"
done
# Marker is last: partial uploads can never qualify as a completed backup.
printf '{"completedAt":"%s","snapshot":"database-daily/%s","verification":"pg_restore --list; shared MVCC fingerprints; SHA256SUMS"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$stamp" | rclone rcat "$destination/complete.json"
echo "Logical database backup completed: database-daily/$stamp"
