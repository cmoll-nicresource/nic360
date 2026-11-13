-- Additive event marketing schema: draft agenda, agenda switch, travel, sponsorship,
-- receive-updates link, readable page addresses, who attends, key dates, practical
-- information and highlights.
--
-- The only existing data touched is the new `slug` column, which is filled in from each
-- event's name. No event, session, order or registration is otherwise changed, and
-- nothing is dropped. Existing events keep a NULL agenda mode, which the site reads as
-- "full agenda". Safe to run more than once.
BEGIN;
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_events_agenda_mode') THEN
    CREATE TYPE public.enum_events_agenda_mode AS ENUM ('draft', 'sessions');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum__events_v_version_agenda_mode') THEN
    CREATE TYPE public.enum__events_v_version_agenda_mode AS ENUM ('draft', 'sessions');
  END IF;
END
$$;

-- Columns are added without a default first so existing rows stay NULL; the default
-- Payload expects is then set for rows created from now on.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS updates_url varchar,
  ADD COLUMN IF NOT EXISTS agenda_mode public.enum_events_agenda_mode,
  ADD COLUMN IF NOT EXISTS draft_agenda jsonb,
  ADD COLUMN IF NOT EXISTS venue_transportation jsonb,
  ADD COLUMN IF NOT EXISTS sponsorship jsonb,
  ADD COLUMN IF NOT EXISTS slug varchar,
  ADD COLUMN IF NOT EXISTS audience_intro jsonb,
  ADD COLUMN IF NOT EXISTS highlights_video_url varchar;
ALTER TABLE public.events
  ALTER COLUMN agenda_mode SET DEFAULT 'draft'::public.enum_events_agenda_mode;

ALTER TABLE public._events_v
  ADD COLUMN IF NOT EXISTS version_updates_url varchar,
  ADD COLUMN IF NOT EXISTS version_agenda_mode public.enum__events_v_version_agenda_mode,
  ADD COLUMN IF NOT EXISTS version_draft_agenda jsonb,
  ADD COLUMN IF NOT EXISTS version_venue_transportation jsonb,
  ADD COLUMN IF NOT EXISTS version_sponsorship jsonb,
  ADD COLUMN IF NOT EXISTS version_slug varchar,
  ADD COLUMN IF NOT EXISTS version_audience_intro jsonb,
  ADD COLUMN IF NOT EXISTS version_highlights_video_url varchar;
ALTER TABLE public._events_v
  ALTER COLUMN version_agenda_mode SET DEFAULT 'draft'::public.enum__events_v_version_agenda_mode;

-- Readable page addresses. "GTNF 2026" becomes gtnf-2026. When two events share a name,
-- the earliest keeps the plain address and the others get their record id on the end.
-- Only events without an address are touched, so a second run changes nothing.
WITH base AS (
  SELECT id,
         COALESCE(
           NULLIF(
             trim(both '-' from left(
               regexp_replace(lower(replace(COALESCE(name, ''), '&', ' and ')), '[^a-z0-9]+', '-', 'g'),
               80)),
             ''),
           'event') AS s
  FROM public.events
  WHERE slug IS NULL
),
fixed AS (
  SELECT id, CASE WHEN s ~ '^[0-9]+$' THEN 'event-' || s ELSE s END AS s FROM base
),
ranked AS (
  SELECT id, s, row_number() OVER (PARTITION BY s ORDER BY id) AS n FROM fixed
)
UPDATE public.events e
SET slug = CASE
  WHEN r.n = 1 AND NOT EXISTS (SELECT 1 FROM public.events x WHERE x.slug = r.s) THEN r.s
  ELSE r.s || '-' || e.id
END
FROM ranked r
WHERE e.id = r.id;

-- The admin edits the latest saved version, so versions carry the same address.
UPDATE public._events_v v
SET version_slug = e.slug
FROM public.events e
WHERE v.parent_id = e.id AND v.version_slug IS NULL AND e.slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_slug_idx ON public.events USING btree (slug);
CREATE INDEX IF NOT EXISTS _events_v_version_version_slug_idx ON public._events_v USING btree (version_slug);

-- Highlight photos use the events' existing relationship tables.
ALTER TABLE public.events_rels ADD COLUMN IF NOT EXISTS media_id integer;
ALTER TABLE public._events_v_rels ADD COLUMN IF NOT EXISTS media_id integer;
CREATE INDEX IF NOT EXISTS events_rels_media_id_idx ON public.events_rels USING btree (media_id);
CREATE INDEX IF NOT EXISTS _events_v_rels_media_id_idx ON public._events_v_rels USING btree (media_id);

-- Lists on the event: headline figures, key dates, questions and delegate quotes.
CREATE TABLE IF NOT EXISTS public.events_audience_stats (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id varchar PRIMARY KEY,
  value varchar,
  label varchar
);
CREATE TABLE IF NOT EXISTS public.events_key_dates (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id varchar PRIMARY KEY,
  label varchar,
  date timestamp(3) with time zone
);
CREATE TABLE IF NOT EXISTS public.events_faq (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id varchar PRIMARY KEY,
  question varchar,
  answer jsonb
);
CREATE TABLE IF NOT EXISTS public.events_highlights_testimonials (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id varchar PRIMARY KEY,
  quote varchar,
  name varchar,
  organisation varchar
);
CREATE TABLE IF NOT EXISTS public._events_v_version_audience_stats (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id serial PRIMARY KEY,
  value varchar,
  label varchar,
  _uuid varchar
);
CREATE TABLE IF NOT EXISTS public._events_v_version_key_dates (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id serial PRIMARY KEY,
  label varchar,
  date timestamp(3) with time zone,
  _uuid varchar
);
CREATE TABLE IF NOT EXISTS public._events_v_version_faq (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id serial PRIMARY KEY,
  question varchar,
  answer jsonb,
  _uuid varchar
);
CREATE TABLE IF NOT EXISTS public._events_v_version_highlights_testimonials (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id serial PRIMARY KEY,
  quote varchar,
  name varchar,
  organisation varchar,
  _uuid varchar
);

CREATE INDEX IF NOT EXISTS events_audience_stats_order_idx ON public.events_audience_stats USING btree (_order);
CREATE INDEX IF NOT EXISTS events_audience_stats_parent_id_idx ON public.events_audience_stats USING btree (_parent_id);
CREATE INDEX IF NOT EXISTS events_key_dates_order_idx ON public.events_key_dates USING btree (_order);
CREATE INDEX IF NOT EXISTS events_key_dates_parent_id_idx ON public.events_key_dates USING btree (_parent_id);
CREATE INDEX IF NOT EXISTS events_faq_order_idx ON public.events_faq USING btree (_order);
CREATE INDEX IF NOT EXISTS events_faq_parent_id_idx ON public.events_faq USING btree (_parent_id);
CREATE INDEX IF NOT EXISTS events_highlights_testimonials_order_idx ON public.events_highlights_testimonials USING btree (_order);
CREATE INDEX IF NOT EXISTS events_highlights_testimonials_parent_id_idx ON public.events_highlights_testimonials USING btree (_parent_id);
CREATE INDEX IF NOT EXISTS _events_v_version_audience_stats_order_idx ON public._events_v_version_audience_stats USING btree (_order);
CREATE INDEX IF NOT EXISTS _events_v_version_audience_stats_parent_id_idx ON public._events_v_version_audience_stats USING btree (_parent_id);
CREATE INDEX IF NOT EXISTS _events_v_version_key_dates_order_idx ON public._events_v_version_key_dates USING btree (_order);
CREATE INDEX IF NOT EXISTS _events_v_version_key_dates_parent_id_idx ON public._events_v_version_key_dates USING btree (_parent_id);
CREATE INDEX IF NOT EXISTS _events_v_version_faq_order_idx ON public._events_v_version_faq USING btree (_order);
CREATE INDEX IF NOT EXISTS _events_v_version_faq_parent_id_idx ON public._events_v_version_faq USING btree (_parent_id);
CREATE INDEX IF NOT EXISTS _events_v_version_highlights_testimonials_order_idx ON public._events_v_version_highlights_testimonials USING btree (_order);
CREATE INDEX IF NOT EXISTS _events_v_version_highlights_testimonials_parent_id_idx ON public._events_v_version_highlights_testimonials USING btree (_parent_id);

-- Foreign keys, each added only if it is not already there.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('events_rels', 'events_rels_media_fk', 'media_id', 'media'),
      ('_events_v_rels', '_events_v_rels_media_fk', 'media_id', 'media'),
      ('events_audience_stats', 'events_audience_stats_parent_id_fk', '_parent_id', 'events'),
      ('events_key_dates', 'events_key_dates_parent_id_fk', '_parent_id', 'events'),
      ('events_faq', 'events_faq_parent_id_fk', '_parent_id', 'events'),
      ('events_highlights_testimonials', 'events_highlights_testimonials_parent_id_fk', '_parent_id', 'events'),
      ('_events_v_version_audience_stats', '_events_v_version_audience_stats_parent_id_fk', '_parent_id', '_events_v'),
      ('_events_v_version_key_dates', '_events_v_version_key_dates_parent_id_fk', '_parent_id', '_events_v'),
      ('_events_v_version_faq', '_events_v_version_faq_parent_id_fk', '_parent_id', '_events_v'),
      ('_events_v_version_highlights_testimonials', '_events_v_version_highlights_testimonials_parent_id_fk', '_parent_id', '_events_v')
    ) AS t(tbl, con, col, target)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = item.con AND conrelid = ('public.' || quote_ident(item.tbl))::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE',
        item.tbl, item.con, item.col, item.target);
    END IF;
  END LOOP;
END
$$;

COMMIT;
