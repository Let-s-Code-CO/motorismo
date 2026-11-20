-- municipalities — the Colombian municipalities a car plate can be issued in (spec 005, HU-07).
--
-- A car stores the city that issued its plate, picked from a fixed list (RF-07, RN-11) that comes
-- from DANE's DIVIPOLA and lives in a data migration. This file guards:
--   * the shape: the DANE code (five digits) is the key; name and department are required;
--   * access: anyone signed in reads the list (it is public data), nobody writes it through the
--     API, and anon gets nothing;
--   * the data: 1,104 municipalities (the 1,103 "Municipio" plus the island of San Andrés) in 33
--     departments, without the "áreas no municipalizadas"; the three cities the form lists first
--     (Bogotá, D.C., La Calera, Funza) with their codes; DANE's spelling with initial capitals;
--     homonyms kept apart by their department (CA-30).
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

-- Shape --------------------------------------------------------------------------------------------
select has_table('public', 'municipalities', 'the municipalities table exists');
select col_is_pk('public', 'municipalities', 'code', 'the DANE code is the key');
select col_not_null('public', 'municipalities', 'name', 'a municipality has a name');
select col_not_null('public', 'municipalities', 'department', 'a municipality has a department');
select throws_ok(
  $$ insert into public.municipalities (code, name, department) values ('1100', 'Corto', 'Prueba') $$,
  '23514', null,
  'the code is five digits (a four-digit code is refused)'
);

-- Access (public data, read-only from the API) ------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.municipalities'::regclass),
  'RLS is enabled on municipalities'
);
select policies_are('public', 'municipalities', array['municipalities_select_authenticated'],
  'the only policy lets signed-in users read');
select ok(
  has_table_privilege('authenticated', 'public.municipalities', 'SELECT')
  and not has_table_privilege('authenticated', 'public.municipalities', 'INSERT')
  and not has_table_privilege('authenticated', 'public.municipalities', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.municipalities', 'DELETE'),
  'RF-07: a signed-in user reads the list and cannot change it'
);
select ok(
  not has_table_privilege('anon', 'public.municipalities', 'SELECT'),
  'anon cannot read the list'
);

-- Data (RF-07) -------------------------------------------------------------------------------------
select is((select count(*)::int from public.municipalities), 1104,
  'RF-07: 1,104 municipalities (1,103 "Municipio" + the island of San Andrés)');
select is((select count(distinct department)::int from public.municipalities), 33,
  'RF-07: they belong to 33 departments (32 plus Bogotá, D.C.)');
select results_eq(
  $$ select code, name, department from public.municipalities
     where code in ('11001', '25377', '25286') order by code $$,
  $$ values ('11001', 'Bogotá, D.C.', 'Bogotá, D.C.'),
            ('25286', 'Funza', 'Cundinamarca'),
            ('25377', 'La Calera', 'Cundinamarca') $$,
  'CA-30: Bogotá, D.C. (11001), Funza (25286) and La Calera (25377), the cities listed first'
);
select results_eq(
  $$ select name from public.municipalities where code in ('25843', '05148') order by code $$,
  $$ values ('El Carmen de Viboral'), ('Villa de San Diego de Ubaté') $$,
  'DANE spelling with initial capitals and lower-case connectors'
);
select results_eq(
  $$ select department from public.municipalities where name = 'Armenia' order by department $$,
  $$ values ('Antioquia'), ('Quindío') $$,
  'CA-30: a name repeated in two departments is two municipalities, told apart by department'
);
select is_empty(
  $$ select 1 from public.municipalities where name = 'La Chorrera' $$,
  'the "áreas no municipalizadas" are left out (La Chorrera, Amazonas)'
);

select * from finish();
rollback;
