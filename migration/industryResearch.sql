-- Additive Industry Research schema. No existing user/content rows are rewritten.
BEGIN;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='enum_research_ingestion_source') THEN CREATE TYPE public.enum_research_ingestion_source AS ENUM ('manual','statenet','uspto','extension','migration'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='enum_research_status') THEN CREATE TYPE public.enum_research_status AS ENUM ('draft','published'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='enum__research_v_version_ingestion_source') THEN CREATE TYPE public.enum__research_v_version_ingestion_source AS ENUM ('manual','statenet','uspto','extension','migration'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='enum__research_v_version_status') THEN CREATE TYPE public.enum__research_v_version_status AS ENUM ('draft','published'); END IF; END $$;
ALTER TYPE public.enum_publications_category ADD VALUE IF NOT EXISTS 'research';
ALTER TYPE public.enum_publications_generator ADD VALUE IF NOT EXISTS 'monthly-research-digest';
DO $research_schema$ BEGIN
IF to_regclass('public.research') IS NULL THEN
CREATE TABLE public._research_v (
    id integer NOT NULL,
    parent_id integer,
    version_title character varying,
    version_authors character varying,
    version_published_date timestamp(3) with time zone,
    version_journal_id integer,
    version_doi_link character varying,
    version_body jsonb,
    version_source_url character varying,
    version_doi_key character varying,
    version_ingestion_source public.enum__research_v_version_ingestion_source DEFAULT 'manual'::public.enum__research_v_version_ingestion_source,
    version_ingestion_external_id character varying,
    version_ingestion_imported_at timestamp(3) with time zone,
    version_search_text character varying,
    version_updated_at timestamp(3) with time zone,
    version_created_at timestamp(3) with time zone,
    version__status public.enum__research_v_version_status DEFAULT 'draft'::public.enum__research_v_version_status,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    latest boolean
);



CREATE SEQUENCE public._research_v_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE public._research_v_id_seq OWNED BY public._research_v.id;



CREATE TABLE public.journals (
    id integer NOT NULL,
    name character varying NOT NULL,
    homepage character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL
);



CREATE SEQUENCE public.journals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE public.journals_id_seq OWNED BY public.journals.id;



CREATE TABLE public.research (
    id integer NOT NULL,
    title character varying,
    authors character varying,
    published_date timestamp(3) with time zone,
    journal_id integer,
    doi_link character varying,
    body jsonb,
    source_url character varying,
    doi_key character varying,
    ingestion_source public.enum_research_ingestion_source DEFAULT 'manual'::public.enum_research_ingestion_source,
    ingestion_external_id character varying,
    ingestion_imported_at timestamp(3) with time zone,
    search_text character varying,
    updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    created_at timestamp(3) with time zone DEFAULT now() NOT NULL,
    _status public.enum_research_status DEFAULT 'draft'::public.enum_research_status
);



CREATE SEQUENCE public.research_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



ALTER SEQUENCE public.research_id_seq OWNED BY public.research.id;



ALTER TABLE ONLY public._research_v ALTER COLUMN id SET DEFAULT nextval('public._research_v_id_seq'::regclass);



ALTER TABLE ONLY public.journals ALTER COLUMN id SET DEFAULT nextval('public.journals_id_seq'::regclass);



ALTER TABLE ONLY public.research ALTER COLUMN id SET DEFAULT nextval('public.research_id_seq'::regclass);



ALTER TABLE ONLY public._research_v
    ADD CONSTRAINT _research_v_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.journals
    ADD CONSTRAINT journals_pkey PRIMARY KEY (id);



ALTER TABLE ONLY public.research
    ADD CONSTRAINT research_pkey PRIMARY KEY (id);



CREATE INDEX _research_v_created_at_idx ON public._research_v USING btree (created_at);



CREATE INDEX _research_v_latest_idx ON public._research_v USING btree (latest);



CREATE INDEX _research_v_parent_idx ON public._research_v USING btree (parent_id);



CREATE INDEX _research_v_updated_at_idx ON public._research_v USING btree (updated_at);



CREATE INDEX _research_v_version_version__status_idx ON public._research_v USING btree (version__status);



CREATE INDEX _research_v_version_version_created_at_idx ON public._research_v USING btree (version_created_at);



CREATE INDEX _research_v_version_version_doi_key_idx ON public._research_v USING btree (version_doi_key);



CREATE INDEX _research_v_version_version_journal_idx ON public._research_v USING btree (version_journal_id);



CREATE INDEX _research_v_version_version_source_url_idx ON public._research_v USING btree (version_source_url);



CREATE INDEX _research_v_version_version_updated_at_idx ON public._research_v USING btree (version_updated_at);



CREATE INDEX journals_created_at_idx ON public.journals USING btree (created_at);



CREATE UNIQUE INDEX journals_name_idx ON public.journals USING btree (name);



CREATE INDEX journals_updated_at_idx ON public.journals USING btree (updated_at);



CREATE INDEX research__status_idx ON public.research USING btree (_status);



CREATE INDEX research_created_at_idx ON public.research USING btree (created_at);



CREATE UNIQUE INDEX research_doi_key_idx ON public.research USING btree (doi_key);



CREATE INDEX research_journal_idx ON public.research USING btree (journal_id);



CREATE UNIQUE INDEX research_source_url_idx ON public.research USING btree (source_url);



CREATE INDEX research_updated_at_idx ON public.research USING btree (updated_at);



ALTER TABLE ONLY public._research_v
    ADD CONSTRAINT _research_v_parent_id_research_id_fk FOREIGN KEY (parent_id) REFERENCES public.research(id) ON DELETE SET NULL;



ALTER TABLE ONLY public._research_v
    ADD CONSTRAINT _research_v_version_journal_id_journals_id_fk FOREIGN KEY (version_journal_id) REFERENCES public.journals(id) ON DELETE SET NULL;



ALTER TABLE ONLY public.research
    ADD CONSTRAINT research_journal_id_journals_id_fk FOREIGN KEY (journal_id) REFERENCES public.journals(id) ON DELETE SET NULL;
END IF;
IF to_regclass('public.journals') IS NULL OR to_regclass('public._research_v') IS NULL THEN RAISE EXCEPTION 'Incomplete research schema; restore or repair before continuing'; END IF;
END $research_schema$;
ALTER TABLE public.publication_issues ADD COLUMN IF NOT EXISTS research_report_key varchar;
ALTER TABLE public._publication_issues_v ADD COLUMN IF NOT EXISTS version_research_report_key varchar;
CREATE UNIQUE INDEX IF NOT EXISTS publication_issues_research_report_key_idx ON public.publication_issues(research_report_key);
CREATE INDEX IF NOT EXISTS _publication_issues_v_version_version_research_report_ke_idx ON public._publication_issues_v(version_research_report_key);
ALTER TABLE public.payload_locked_documents_rels ADD COLUMN IF NOT EXISTS research_id integer;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_research_id_idx ON public.payload_locked_documents_rels(research_id);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payload_locked_documents_rels_research_fk' AND conrelid='public.payload_locked_documents_rels'::regclass) THEN ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_research_fk FOREIGN KEY (research_id) REFERENCES public.research(id) ON DELETE CASCADE; END IF; END $$;
ALTER TABLE public.payload_locked_documents_rels ADD COLUMN IF NOT EXISTS journals_id integer;
CREATE INDEX IF NOT EXISTS payload_locked_documents_rels_journals_id_idx ON public.payload_locked_documents_rels(journals_id);
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='payload_locked_documents_rels_journals_fk' AND conrelid='public.payload_locked_documents_rels'::regclass) THEN ALTER TABLE public.payload_locked_documents_rels ADD CONSTRAINT payload_locked_documents_rels_journals_fk FOREIGN KEY (journals_id) REFERENCES public.journals(id) ON DELETE CASCADE; END IF; END $$;
COMMIT;
