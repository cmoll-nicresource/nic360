-- Additive account email log. Creates one new table and its enums; no existing row,
-- column or table is changed. Safe to run more than once.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_account_emails_kind') THEN
    CREATE TYPE public.enum_account_emails_kind AS ENUM ('reset', 'invitation', 'account-ready', 'signup-code', 'verification', 'staff-reset', 'staff-link');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_account_emails_status') THEN
    CREATE TYPE public.enum_account_emails_status AS ENUM ('sent', 'delivered', 'bounced', 'complained', 'failed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.account_emails (
  id serial PRIMARY KEY,
  recipient varchar NOT NULL,
  kind public.enum_account_emails_kind NOT NULL,
  subject varchar NOT NULL,
  status public.enum_account_emails_status NOT NULL DEFAULT 'sent',
  status_at timestamp(3) with time zone,
  stuck boolean DEFAULT false,
  link_expires_at timestamp(3) with time zone,
  message_id varchar,
  error varchar,
  note varchar,
  issued_by_id integer,
  html varchar,
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  created_at timestamp(3) with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_emails_recipient_idx ON public.account_emails USING btree (recipient);
CREATE INDEX IF NOT EXISTS account_emails_stuck_idx ON public.account_emails USING btree (stuck);
CREATE INDEX IF NOT EXISTS account_emails_message_id_idx ON public.account_emails USING btree (message_id);
CREATE INDEX IF NOT EXISTS account_emails_issued_by_idx ON public.account_emails USING btree (issued_by_id);
CREATE INDEX IF NOT EXISTS account_emails_updated_at_idx ON public.account_emails USING btree (updated_at);
CREATE INDEX IF NOT EXISTS account_emails_created_at_idx ON public.account_emails USING btree (created_at);

DO $$ BEGIN
  ALTER TABLE public.account_emails ADD CONSTRAINT account_emails_issued_by_id_staff_id_fk FOREIGN KEY (issued_by_id) REFERENCES public.staff(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payload_locked_documents_rels ADD COLUMN IF NOT EXISTS account_emails_id integer;
DO $$ BEGIN
  ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_account_emails_fk FOREIGN KEY (account_emails_id) REFERENCES public.account_emails(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_account_emails_id_idx ON public.payload_locked_documents_rels USING btree (account_emails_id);

COMMIT;
