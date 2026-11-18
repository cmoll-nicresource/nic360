-- Additive: Executive Summary stories copied from Tobacco Reporter, the weekly
-- Executive Summary headings (seeded with the 13 used in the 2026-11-06 edition),
-- and the "story-list" issue format. Creates new tables and adds nullable
-- columns and enum values; no existing row is changed or removed. Safe to run
-- more than once.
BEGIN;
SET LOCAL lock_timeout = '10s';

ALTER TYPE public.enum_publications_format ADD VALUE IF NOT EXISTS 'story-list' AFTER 'excerpt-list';
ALTER TYPE public.enum_publication_issues_format ADD VALUE IF NOT EXISTS 'story-list' AFTER 'excerpt-list';
ALTER TYPE public.enum__publication_issues_v_version_format ADD VALUE IF NOT EXISTS 'story-list' AFTER 'excerpt-list';

CREATE TABLE IF NOT EXISTS public.summary_headings (
  id serial PRIMARY KEY,
  _order varchar,
  title varchar NOT NULL,
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  created_at timestamp(3) with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS summary_headings__order_idx ON public.summary_headings USING btree (_order);
CREATE UNIQUE INDEX IF NOT EXISTS summary_headings_title_idx ON public.summary_headings USING btree (title);
CREATE INDEX IF NOT EXISTS summary_headings_updated_at_idx ON public.summary_headings USING btree (updated_at);
CREATE INDEX IF NOT EXISTS summary_headings_created_at_idx ON public.summary_headings USING btree (created_at);

CREATE TABLE IF NOT EXISTS public.summary_stories (
  id serial PRIMARY KEY,
  headline varchar NOT NULL,
  heading_id integer,
  body_html varchar,
  image_id integer,
  published_at timestamp(3) with time zone,
  wordpress_post_id numeric,
  wordpress_url varchar,
  wordpress_headline varchar,
  wordpress_author varchar,
  wordpress_image_url varchar,
  wordpress_modified_at timestamp(3) with time zone,
  wordpress_copied_at timestamp(3) with time zone,
  updated_at timestamp(3) with time zone NOT NULL DEFAULT now(),
  created_at timestamp(3) with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS summary_stories_heading_idx ON public.summary_stories USING btree (heading_id);
CREATE INDEX IF NOT EXISTS summary_stories_image_idx ON public.summary_stories USING btree (image_id);
CREATE UNIQUE INDEX IF NOT EXISTS summary_stories_wordpress_wordpress_post_id_idx ON public.summary_stories USING btree (wordpress_post_id);
CREATE INDEX IF NOT EXISTS summary_stories_updated_at_idx ON public.summary_stories USING btree (updated_at);
CREATE INDEX IF NOT EXISTS summary_stories_created_at_idx ON public.summary_stories USING btree (created_at);
DO $$ BEGIN
  ALTER TABLE public.summary_stories ADD CONSTRAINT summary_stories_heading_id_summary_headings_id_fk FOREIGN KEY (heading_id) REFERENCES public.summary_headings(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.summary_stories ADD CONSTRAINT summary_stories_image_id_media_id_fk FOREIGN KEY (image_id) REFERENCES public.media(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.summary_stories_sources (
  _order integer NOT NULL,
  _parent_id integer NOT NULL,
  id varchar PRIMARY KEY,
  name varchar NOT NULL,
  url varchar
);
CREATE INDEX IF NOT EXISTS summary_stories_sources_order_idx ON public.summary_stories_sources USING btree (_order);
CREATE INDEX IF NOT EXISTS summary_stories_sources_parent_id_idx ON public.summary_stories_sources USING btree (_parent_id);
DO $$ BEGIN
  ALTER TABLE public.summary_stories_sources ADD CONSTRAINT summary_stories_sources_parent_id_fk FOREIGN KEY (_parent_id) REFERENCES public.summary_stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Issue -> stories (live and draft versions).
ALTER TABLE public.publication_issues_rels ADD COLUMN IF NOT EXISTS summary_stories_id integer;
CREATE INDEX IF NOT EXISTS publication_issues_rels_summary_stories_id_idx ON public.publication_issues_rels USING btree (summary_stories_id);
DO $$ BEGIN
  ALTER TABLE public.publication_issues_rels ADD CONSTRAINT publication_issues_rels_summary_stories_fk FOREIGN KEY (summary_stories_id) REFERENCES public.summary_stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public._publication_issues_v_rels ADD COLUMN IF NOT EXISTS summary_stories_id integer;
CREATE INDEX IF NOT EXISTS _publication_issues_v_rels_summary_stories_id_idx ON public._publication_issues_v_rels USING btree (summary_stories_id);
DO $$ BEGIN
  ALTER TABLE public._publication_issues_v_rels ADD CONSTRAINT _publication_issues_v_rels_summary_stories_fk FOREIGN KEY (summary_stories_id) REFERENCES public.summary_stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Admin document locks for the two new collections.
ALTER TABLE public.payload_locked_documents_rels ADD COLUMN IF NOT EXISTS summary_stories_id integer;
ALTER TABLE public.payload_locked_documents_rels ADD COLUMN IF NOT EXISTS summary_headings_id integer;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_summary_stories_id_idx ON public.payload_locked_documents_rels USING btree (summary_stories_id);
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_summary_headings_id_idx ON public.payload_locked_documents_rels USING btree (summary_headings_id);
DO $$ BEGIN
  ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_summary_stories_fk FOREIGN KEY (summary_stories_id) REFERENCES public.summary_stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_summary_headings_fk FOREIGN KEY (summary_headings_id) REFERENCES public.summary_headings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Starting headings, in the order of the 2026-11-06 weekly Executive Summary.
-- _order values are fractional-index keys (Payload's drag-to-reorder); editors can rename, add or reorder.
INSERT INTO public.summary_headings (_order, title) VALUES
  ('b10', 'GTNF'),
  ('b11', 'FDA & U.S. Federal News'),
  ('b12', 'Society & Politics'),
  ('b13', 'Business, Finance, & Personnel'),
  ('b14', 'Brands, Trademarks & Patents'),
  ('b15', 'Cigars'),
  ('b16', 'Taxation & Duties'),
  ('b17', 'Illicit Trade, Crime, Legal Proceedings'),
  ('b18', 'Agriculture & Markets'),
  ('b19', 'Global Regulation'),
  ('b20', 'Science, Technology, & Reports'),
  ('b21', 'Retail & Distribution'),
  ('b22', 'Adjacent Industries')
ON CONFLICT (title) DO NOTHING;

COMMIT;
