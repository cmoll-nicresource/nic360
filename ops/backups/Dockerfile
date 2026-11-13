FROM rclone/rclone@sha256:2687085f718d3c628f7fdfb77c52a1d344332aed543110bb88088f2c70d43eb5 AS rclone
FROM postgres:18.7@sha256:9f4fd4aa918f52ae3d6f3b687f1de90d8f867cd4d520021545a9a50c120eae3b
COPY --from=rclone /usr/local/bin/rclone /usr/local/bin/rclone
COPY --from=rclone /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY ops/backups/logical-backup.sh ops/backups/database-fingerprints.sql /ops/
ENTRYPOINT ["/bin/sh", "/ops/logical-backup.sh"]
