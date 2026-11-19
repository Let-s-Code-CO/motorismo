-- vehicle catalog — the brands per type and lines per brand that come preloaded (spec 005).
--
-- The brand and the line of a vehicle are picked from a catalog that arrives with the most common
-- ones in Colombia (RF-03) and grows on its own (CA-13). This file guards:
--   * the catalog key (RN-06): two names are the same brand or line when they match ignoring case,
--     accents, spaces and hyphens. The app filters suggestions with the SAME rule
--     (catalog-key.utils.ts); these cases are repeated in its unit test;
--   * the preloaded catalog: every type has brands, the main motorcycle and car brands have lines,
--     and lines belong to a brand within a type (CA-10, CA-11, RF-03, RF-04).
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- RN-06: the catalog key ---------------------------------------------------------------------------
select is(private.catalog_key('GSX-R600'), 'gsxr600', 'catalog key: hyphens are ignored');
select is(private.catalog_key('gsx r600'), 'gsxr600', 'catalog key: spaces and case are ignored');
select is(private.catalog_key('GSXR 600'), 'gsxr600', 'catalog key: GSXR 600 is the same line as GSX-R600');
select is(private.catalog_key('Citroën'), 'citroen', 'catalog key: accents are ignored');
select is(private.catalog_key('  Mazda 2 '), 'mazda2', 'catalog key: surrounding spaces are ignored');

-- RF-03: the preloaded catalog ----------------------------------------------------------------------
select results_eq(
  $$ select vehicle_type::text, count(*) >= case vehicle_type when 'motorcycle' then 20 when 'car' then 25 else 15 end
     from public.vehicle_brands group by vehicle_type order by vehicle_type $$,
  $$ values ('bicycle', true), ('car', true), ('motorcycle', true) $$,
  'CA-11: every type comes with its common brands (at least 20 motorcycle, 25 car and 15 bicycle brands)'
);
select is_empty(
  $$ select b.name from public.vehicle_brands b
     where b.vehicle_type = 'motorcycle' and b.name in ('AKT', 'Bajaj', 'Honda', 'Yamaha', 'Suzuki')
       and (select count(*) from public.vehicle_lines l where l.brand_id = b.id) < 5 $$,
  'CA-11: the main motorcycle brands (AKT, Bajaj, Honda, Yamaha, Suzuki) come with at least 5 lines each'
);
select is_empty(
  $$ select b.name from public.vehicle_brands b
     where b.vehicle_type = 'car' and b.name in ('Kia', 'Renault', 'Toyota', 'Chevrolet', 'Mazda')
       and (select count(*) from public.vehicle_lines l where l.brand_id = b.id) < 5 $$,
  'CA-11: the main car brands (Kia, Renault, Toyota, Chevrolet, Mazda) come with at least 5 lines each'
);
select is(
  (select count(*)::int from public.vehicle_brands
   where name in ('AKT', 'Bajaj', 'Honda', 'Yamaha', 'Suzuki', 'Kia', 'Renault', 'Toyota', 'Chevrolet', 'Mazda')),
  12,
  'the main brands exist (Honda and Suzuki once as motorcycle and once as car: 10 names, 12 entries)'
);
select ok(
  exists (select 1 from public.vehicle_lines l join public.vehicle_brands b on b.id = l.brand_id
          where b.vehicle_type = 'motorcycle' and b.name = 'Suzuki' and l.name = 'GSX-R600'),
  'CA-10: Suzuki (motorcycle) has the line GSX-R600'
);
select ok(
  not exists (select 1 from public.vehicle_lines l join public.vehicle_brands b on b.id = l.brand_id
              where b.vehicle_type = 'car' and b.name = 'Suzuki' and l.name_key = 'gsxr600'),
  'RF-04: Suzuki (car) does not have the motorcycle line GSX-R600'
);
select ok(
  exists (select 1 from public.vehicle_brands where vehicle_type = 'bicycle' and name = 'GW'),
  'CA-11: the bicycle catalog has GW'
);

select * from finish();
rollback;
