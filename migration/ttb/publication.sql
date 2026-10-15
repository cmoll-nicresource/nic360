-- Run after payload-schema.sql has committed its new enum value.
-- Creates the report destination only; does not generate or send an issue.
begin;
set local lock_timeout = '5s';

insert into public.publications (title, slug, description, format, frequency, generator)
select 'US Tobacco Trade Barometer', 'us-tobacco-trade-barometer',
       'Monthly US tobacco imports and exports, based on Census trade data.',
       'pdf-report', 'monthly', 'monthly-trade-barometer'
where not exists (
  select 1 from public.publications where generator::text = 'monthly-trade-barometer'
);

insert into public.publications_category ("order", parent_id, value)
select 1, p.id, 'news' from public.publications p
where p.generator::text = 'monthly-trade-barometer'
  and not exists (select 1 from public.publications_category c where c.parent_id = p.id);

commit;
