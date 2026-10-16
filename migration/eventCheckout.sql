-- Additive checkout/fulfillment state. No existing orders, tickets or readers are changed.
BEGIN;
SET LOCAL lock_timeout = '10s';
ALTER TYPE public.enum_event_registrations_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.enum_payload_jobs_task_slug ADD VALUE IF NOT EXISTS 'invite-event-attendees';
ALTER TYPE public.enum_payload_jobs_log_task_slug ADD VALUE IF NOT EXISTS 'invite-event-attendees';
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stripe_session_id varchar,
  ADD COLUMN IF NOT EXISTS checkout_expires_at timestamp(3) with time zone,
  ADD COLUMN IF NOT EXISTS fulfillment_error varchar;
CREATE INDEX IF NOT EXISTS orders_stripe_session_id_idx ON public.orders(stripe_session_id);
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS invite_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invite_sent_at timestamp(3) with time zone;
COMMIT;
