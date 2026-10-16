-- Additive operations monitoring. Existing content, reader preferences and jobs are unchanged.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TYPE public.enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'monitor-operations';
ALTER TYPE public.enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'monitor-operations';
CREATE TABLE IF NOT EXISTS public.operational_alerts (
  id serial PRIMARY KEY,
  alert_key varchar NOT NULL,
  title varchar NOT NULL,
  message varchar NOT NULL,
  source_path varchar NOT NULL,
  resolved boolean DEFAULT false,
  last_seen_at timestamp(3) with time zone NOT NULL,
  notified_at timestamp(3) with time zone,
  notification_attempted_at timestamp(3) with time zone,
  notification_error varchar,
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  created_at timestamp(3) with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS operational_alerts_alert_key_idx ON public.operational_alerts(alert_key);
CREATE INDEX IF NOT EXISTS operational_alerts_resolved_idx ON public.operational_alerts(resolved);
CREATE INDEX IF NOT EXISTS operational_alerts_updated_at_idx ON public.operational_alerts(updated_at);
CREATE INDEX IF NOT EXISTS operational_alerts_created_at_idx ON public.operational_alerts(created_at);
ALTER TABLE public.payload_locked_documents_rels ADD COLUMN IF NOT EXISTS operational_alerts_id integer;
DO $$ BEGIN
  ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_operational_alerts_fk FOREIGN KEY (operational_alerts_id) REFERENCES public.operational_alerts(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_operational_alerts_id_idx ON public.payload_locked_documents_rels(operational_alerts_id);
COMMIT;
