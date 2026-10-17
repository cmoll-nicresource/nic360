FROM rclone/rclone@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5 AS rclone
FROM postgres:18@sha256:74935e72241653ca55e0414067e6d8763aceb8a810eb51b452253ec3dcfc4336
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY ops/backups/logical-backup.sh ops/backups/database-fingerprints.sql /ops/
ENTRYPOINT ["/bin/sh", "/ops/logical-backup.sh"]
