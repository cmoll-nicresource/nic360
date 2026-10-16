-- Additive newsletter schema. No readers, preferences, issues or existing jobs are changed.
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$ BEGIN
  CREATE TYPE public.enum_newsletter_deliveries_status AS ENUM ('queued','sending','sent','failed','unknown','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE public.enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'send-newsletter';
ALTER TYPE public.enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'send-newsletter';

ALTER TABLE public.publication_issues
  ADD COLUMN IF NOT EXISTS email_send_html varchar,
  ADD COLUMN IF NOT EXISTS email_send_subject varchar,
  ADD COLUMN IF NOT EXISTS email_target_count numeric,
  ADD COLUMN IF NOT EXISTS email_last_error varchar,
  ADD COLUMN IF NOT EXISTS email_send_ad_ids jsonb,
  ADD COLUMN IF NOT EXISTS email_ads_recorded boolean DEFAULT false;
ALTER TABLE public._publication_issues_v
  ADD COLUMN IF NOT EXISTS version_email_send_html varchar,
  ADD COLUMN IF NOT EXISTS version_email_send_subject varchar,
  ADD COLUMN IF NOT EXISTS version_email_target_count numeric,
  ADD COLUMN IF NOT EXISTS version_email_last_error varchar,
  ADD COLUMN IF NOT EXISTS version_email_send_ad_ids jsonb,
  ADD COLUMN IF NOT EXISTS version_email_ads_recorded boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.newsletter_deliveries (
  id serial PRIMARY KEY,
  delivery_key varchar NOT NULL,
  issue_id integer CONSTRAINT newsletter_deliveries_issue_id_publication_issues_id_fk REFERENCES public.publication_issues(id) ON DELETE SET NULL,
  user_id integer CONSTRAINT newsletter_deliveries_user_id_users_id_fk REFERENCES public.users(id) ON DELETE SET NULL,
  recipient_email varchar NOT NULL,
  status public.enum_newsletter_deliveries_status NOT NULL DEFAULT 'queued',
  provider_message_id varchar,
  last_error varchar,
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  created_at timestamp(3) with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_deliveries_delivery_key_idx ON public.newsletter_deliveries(delivery_key);
CREATE INDEX IF NOT EXISTS newsletter_deliveries_issue_idx ON public.newsletter_deliveries(issue_id);
CREATE INDEX IF NOT EXISTS newsletter_deliveries_user_idx ON public.newsletter_deliveries(user_id);
CREATE INDEX IF NOT EXISTS newsletter_deliveries_provider_message_id_idx ON public.newsletter_deliveries(provider_message_id);
CREATE INDEX IF NOT EXISTS newsletter_deliveries_updated_at_idx ON public.newsletter_deliveries(updated_at);
CREATE INDEX IF NOT EXISTS newsletter_deliveries_created_at_idx ON public.newsletter_deliveries(created_at);
CREATE TABLE IF NOT EXISTS public.ses_events (
  id serial PRIMARY KEY,
  event_key varchar NOT NULL,
  kind varchar NOT NULL,
  message_id varchar,
  is_test boolean DEFAULT false,
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  created_at timestamp(3) with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ses_events_event_key_idx ON public.ses_events(event_key);
CREATE INDEX IF NOT EXISTS ses_events_updated_at_idx ON public.ses_events(updated_at);
CREATE INDEX IF NOT EXISTS ses_events_created_at_idx ON public.ses_events(created_at);

ALTER TABLE public.payload_locked_documents_rels
  ADD COLUMN IF NOT EXISTS newsletter_deliveries_id integer,
  ADD COLUMN IF NOT EXISTS ses_events_id integer;
DO $$ BEGIN
  ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_newsletter_deliveries_fk FOREIGN KEY (newsletter_deliveries_id) REFERENCES public.newsletter_deliveries(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_ses_events_fk FOREIGN KEY (ses_events_id) REFERENCES public.ses_events(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_newsletter_deliveries_id_idx ON public.payload_locked_documents_rels(newsletter_deliveries_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_ses_events_id_idx ON public.payload_locked_documents_rels(ses_events_id);
COMMIT;
