-- First-time trade-history restore only. Never remove an existing schema.
-- Run with psql --set ON_ERROR_STOP=1 --file migration/ttb/preflight.sql.
begin read only;

select current_database() as target_database;
select nspname as existing_trade_schema
  from pg_namespace where nspname in ('ref', 'trade', 'report');

do $$
begin
  if exists (select 1 from pg_namespace where nspname in ('ref', 'trade', 'report')) then
    raise exception 'Trade schemas already exist. Stop: inspect and back up existing data; do not run a first-time restore.';
  end if;
end
$$;

commit;
