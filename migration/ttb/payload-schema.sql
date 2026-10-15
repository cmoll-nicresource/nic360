-- Additive Payload prerequisites for the trade uploader. No schema push,
-- dropped objects, or changes to existing content. Back up the target first.
begin;
set local lock_timeout = '5s';

alter type public.enum_publications_generator
  add value if not exists 'monthly-trade-barometer';

do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                  where n.nspname = 'public' and t.typname = 'enum_trade_import_runs_status') then
    create type public.enum_trade_import_runs_status as enum ('running', 'succeeded', 'failed');
  end if;
end
$$;

create table if not exists public.trade_import_runs (
  id serial primary key,
  started_at timestamp(3) with time zone not null,
  finished_at timestamp(3) with time zone,
  status public.enum_trade_import_runs_status not null default 'running',
  files_import varchar,
  files_export varchar,
  counts_import_rows numeric default 0,
  counts_export_rows numeric default 0,
  counts_import_replaced numeric default 0,
  counts_export_replaced numeric default 0,
  counts_new_hts_codes numeric default 0,
  counts_new_countries numeric default 0,
  error varchar,
  updated_at timestamp(3) with time zone not null default now(),
  created_at timestamp(3) with time zone not null default now()
);

create table if not exists public.trade_import_runs_data_quality_notes (
  _order integer not null,
  _parent_id integer not null,
  id varchar primary key,
  note varchar not null,
  constraint trade_import_runs_data_quality_notes_parent_id_fk
    foreign key (_parent_id) references public.trade_import_runs(id) on delete cascade
);

create table if not exists public.trade_import_runs_rels (
  id serial primary key,
  "order" integer,
  parent_id integer not null,
  path varchar not null,
  publication_issues_id integer,
  constraint trade_import_runs_rels_parent_fk
    foreign key (parent_id) references public.trade_import_runs(id) on delete cascade,
  constraint trade_import_runs_rels_publication_issues_fk
    foreign key (publication_issues_id) references public.publication_issues(id) on delete cascade
);

create index if not exists trade_import_runs_updated_at_idx on public.trade_import_runs(updated_at);
create index if not exists trade_import_runs_created_at_idx on public.trade_import_runs(created_at);
create index if not exists trade_import_runs_data_quality_notes_order_idx on public.trade_import_runs_data_quality_notes(_order);
create index if not exists trade_import_runs_data_quality_notes_parent_id_idx on public.trade_import_runs_data_quality_notes(_parent_id);
create index if not exists trade_import_runs_rels_order_idx on public.trade_import_runs_rels("order");
create index if not exists trade_import_runs_rels_parent_idx on public.trade_import_runs_rels(parent_id);
create index if not exists trade_import_runs_rels_path_idx on public.trade_import_runs_rels(path);
create index if not exists trade_import_runs_rels_publication_issues_id_idx on public.trade_import_runs_rels(publication_issues_id);

alter table public.payload_locked_documents_rels
  add column if not exists trade_import_runs_id integer;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.payload_locked_documents_rels'::regclass
                    and conname = 'payload_locked_documents_rels_trade_import_runs_fk') then
    alter table public.payload_locked_documents_rels
      add constraint payload_locked_documents_rels_trade_import_runs_fk
      foreign key (trade_import_runs_id) references public.trade_import_runs(id) on delete cascade;
  end if;
end
$$;

create index if not exists payload_locked_documents_rels_trade_import_runs_id_idx
  on public.payload_locked_documents_rels(trade_import_runs_id);

commit;
