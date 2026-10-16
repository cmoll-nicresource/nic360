-- Read-only fingerprints of stable application and trade tables.
-- Queue, lock/session and traffic telemetry tables legitimately change while a backup is exported.
\pset tuples_only on
\pset format unaligned
BEGIN READ ONLY;
SELECT format(
  'SELECT json_build_object(''table'', %L, ''rows'', count(*), ''md5'', md5(coalesce(string_agg(md5(row_to_json(t)::text), '''' ORDER BY md5(row_to_json(t)::text)), ''''))) FROM %I.%I t;',
  schemaname || '.' || tablename, schemaname, tablename
)
FROM pg_tables
WHERE schemaname IN ('public', 'ref', 'trade', 'report')
  AND tablename NOT IN ('payload_jobs', 'payload_jobs_log', 'payload_jobs_stats', 'payload_locked_documents', 'payload_locked_documents_rels', 'page_views', 'livestream_pings', 'staff_sessions', 'users_sessions')
ORDER BY schemaname, tablename
\gexec
COMMIT;
