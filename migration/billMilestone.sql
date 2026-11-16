-- Additive: Bill.milestone (introduced / passed 1 chamber / passed 2 chambers /
-- approved / enacted). Existing bills stay NULL (no milestone set). Nothing is
-- dropped or rewritten. Safe to run more than once.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_bills_milestone') THEN
    CREATE TYPE public.enum_bills_milestone AS ENUM
      ('introduced', 'passed-one-chamber', 'passed-two-chambers', 'approved', 'enacted');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__bills_v_version_milestone') THEN
    CREATE TYPE public.enum__bills_v_version_milestone AS ENUM
      ('introduced', 'passed-one-chamber', 'passed-two-chambers', 'approved', 'enacted');
  END IF;
END
$$;

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS milestone public.enum_bills_milestone;
ALTER TABLE public._bills_v
  ADD COLUMN IF NOT EXISTS version_milestone public.enum__bills_v_version_milestone;

COMMIT;
