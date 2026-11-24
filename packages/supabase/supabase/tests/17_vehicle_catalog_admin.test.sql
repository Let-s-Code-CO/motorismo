-- Managing the vehicle brands and lines catalog (spec 018).
--
-- * Review (RF-02, RN-07, CA-03): what came with the initial load of the catalog (spec 005) is
--   reviewed; what someone typed registering a vehicle is to review (with its date) until the admin
--   registers, renames, marks, or keeps it when merging or moving. Only the admin reads either
--   (RN-06, CA-06): column privileges.
-- * The admin's reading (CA-01, CA-02): the brands of a type in alphabetical order, with how many
--   vehicles (active and retired) use each one and its lines.
-- * Rename (HU-02): the new name shows wherever the vehicle does (orders, report); a name another one
--   has (or remembers) is refused; changing only how it is written is not; it ends reviewed.
-- * Register and mark reviewed (HU-06): a brand or line the admin registers is reviewed, with the
--   same name rules; one marked reviewed is no longer to review.
-- * Merge (HU-03) and move a line (HU-04): every vehicle passes, retired ones too (without touching
--   their retirement date); lines move or merge with an equal one; the absorbed one disappears; the
--   reports keep their totals (CA-17); only within a type (and a brand for lines).
-- * Remembered names (CA-16, RF-03): a merged name or the one before a rename, typed later, gives the
--   one that stayed; never a remembered name equal to a live one (RN-02).
-- * Admin only, in the database (RN-01, CA-05).
begin;
create extension if not exists pgtap with schema extensions;

select plan(87);

-- Helpers ------------------------------------------------------------------------------------------------
create function pg_temp.new_staff(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role) values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', '{}');
  update public.profiles set status = 'active' where id = p_id;
end $$;
create function pg_temp.new_customer(p_id uuid, p_email text, p_name text)
returns uuid language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                          raw_user_meta_data, email_confirmed_at, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', p_name, 'data_consent', true), now(), now());
  return (select id from public.customers where user_id = p_id);
end $$;
create function pg_temp.act_as(p_id uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.error_hint(p_sql text)
returns text language plpgsql as $$
declare v_hint text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return coalesce(nullif(v_hint, ''), sqlstate);
end $$;

create function pg_temp.error_state(p_sql text)
returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlstate;
end $$;

create temp table t_ids (name text primary key, id uuid not null);
grant select, insert on t_ids to authenticated;
create function pg_temp.remember(p_name text, p_id uuid)
returns uuid language sql as $$ insert into t_ids values (p_name, p_id) returning id; $$;
create function pg_temp.id_of(p_name text)
returns uuid language sql stable as $$ select id from t_ids where name = p_name; $$;
create function pg_temp.brand(p_type text, p_name text)
returns uuid language sql stable as $$
  select id from public.vehicle_brands where vehicle_type = p_type::public.vehicle_type and name = p_name;
$$;
-- Whether a line is reviewed, as the admin reads it (the column is out of the API, RN-06).
create function pg_temp.line_reviewed(p_line uuid)
returns boolean language sql as $$
  select (l ->> 'reviewed')::boolean
  from public.vehicle_catalog('motorcycle') c, jsonb_array_elements(c.lines) l
  where (l ->> 'id')::uuid = p_line;
$$;
create function pg_temp.line(p_brand uuid, p_name text)
returns uuid language sql stable as $$
  select id from public.vehicle_lines where brand_id = p_brand and name = p_name;
$$;
-- A motorcycle of Camilo, registered as the admin would (brand and line by name).
create function pg_temp.moto(p_name text, p_brand text, p_line text, p_plate text)
returns uuid language sql as $$
  select pg_temp.remember(p_name, public.save_vehicle(
    p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => p_brand,
    p_line_name => p_line, p_color => 'black', p_plate => p_plate));
$$;

-- Fixtures ----------------------------------------------------------------------------------------------
\set admin '''00000000-0000-0000-0000-0000000018a1'''
\set operator '''00000000-0000-0000-0000-0000000018b1'''
\set camilo_user '''00000000-0000-0000-0000-0000000018c1'''

select pg_temp.new_staff(:admin, 'vc-admin@test.local', 'Ada Admin', 'admin');
select pg_temp.new_staff(:operator, 'vc-op@test.local', 'Omar Operador', 'operator');
select pg_temp.remember('camilo', pg_temp.new_customer(:camilo_user, 'vc-camilo@test.local', 'Camilo Cliente'));
insert into public.employees (full_name) values ('VC Elkin');
select pg_temp.remember('elkin', (select id from public.employees where full_name = 'VC Elkin'));

set local role authenticated;
select pg_temp.act_as(:admin);
-- «Suzuky», a typo of the preloaded Suzuki: one line that Suzuki also has, one it does not.
select pg_temp.moto('suzuky_gsx', 'Suzuky', 'GSX-R600', 'VCA10A');
select pg_temp.moto('suzuky_other', 'Suzuky', 'Pruebalinea Uno', 'VCA11A');
-- An invented brand and line to rename.
select pg_temp.moto('renamed', 'Motorismo Mtrs', 'Clasica Mtrs', 'VCA12A');
select pg_temp.moto('renamed_twin', 'Motorismo Mtrs', 'Deportiva Mtrs', 'VCA13A');
-- Two lines of Yamaha to merge.
select pg_temp.moto('cbr_one', 'Yamaha', 'Cbr Uno', 'VCA14A');
select pg_temp.moto('cbr_two', 'Yamaha', 'Cbr Dos', 'VCA15A');
-- Lines under the wrong brand (Honda) to move to Yamaha: one new there, one Yamaha already has.
select pg_temp.moto('fz', 'Honda', 'Fz Prueba', 'VCA16A');
select pg_temp.moto('same_yamaha', 'Yamaha', 'Linea Igual', 'VCA17A');
select pg_temp.moto('same_honda', 'Honda', 'linea-igual', 'VCA18A');
reset role;

-- One of the Suzuky motorcycles is retired (it still counts, and passes on a merge).
update public.vehicles set retired_at = '2026-11-01 10:00-05' where id = pg_temp.id_of('suzuky_other');
create temp table t_retired as
  select retired_at from public.vehicles where id = pg_temp.id_of('suzuky_other');
grant select on t_retired to authenticated;

-- Closed orders on the Suzuky and the renamed motorcycles (setup, written directly), in the report.
create function pg_temp.closed_order(p_name text, p_vehicle text, p_price integer)
returns void language plpgsql as $$
declare v_order uuid; v_line uuid;
begin
  insert into public.work_orders (customer_id, vehicle_id, opened_at, opened_by, status, closed_at, closed_by)
  values (pg_temp.id_of('camilo'), pg_temp.id_of(p_vehicle), '2026-11-10 09:00-05',
          '00000000-0000-0000-0000-0000000018a1', 'closed', '2026-11-10 11:00-05',
          '00000000-0000-0000-0000-0000000018a1')
  returning id into v_order;
  insert into public.work_order_lines (work_order_id, position, name, price)
  values (v_order, 1, 'Lavado', p_price) returning id into v_line;
  insert into public.work_order_line_employees (line_id, employee_id, share_pct)
  values (v_line, pg_temp.id_of('elkin'), 100);
  perform pg_temp.remember(p_name, v_order);
end $$;
select pg_temp.closed_order('o_suzuky', 'suzuky_gsx', 50000);
select pg_temp.closed_order('o_renamed', 'renamed', 70000);

-- A pending reservation of the renamed motorcycle (setup, written directly).
insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, created_by)
values (pg_temp.id_of('camilo'), pg_temp.id_of('renamed'), '2026-12-01 10:00-05', '2026-12-01 11:00-05',
        '00000000-0000-0000-0000-0000000018a1');
select pg_temp.remember('r_renamed', (select id from public.reservations where vehicle_id = pg_temp.id_of('renamed')));

-- The admin's report, as the admin (security definer functions check the role).
create function pg_temp.report_brand(p_order text)
returns text language sql as $$
  select brand_name from public.service_report('2026-11-01', '2026-11-30')
  where order_id = pg_temp.id_of(p_order);
$$;
create function pg_temp.report_total()
returns integer language sql as $$
  select total from public.service_report_totals('2026-11-01', '2026-11-30');
$$;

-- T001 · Schema, review and permissions ---------------------------------------------------------------
select has_column('public', 'vehicle_brands', 'reviewed', 'a brand knows whether it is reviewed (RF-02)');
select col_default_is('public', 'vehicle_brands', 'reviewed', 'false', 'a brand typed registering a vehicle is to review (RN-07)');
select has_column('public', 'vehicle_lines', 'reviewed', 'a line knows whether it is reviewed (RF-02)');
select has_table('public', 'vehicle_brand_aliases', 'the remembered names of the brands exist (RF-03)');
select has_table('public', 'vehicle_line_aliases', 'the remembered names of the lines exist (RF-03)');

select is((select reviewed from public.vehicle_brands where id = pg_temp.brand('motorcycle', 'Suzuki')),
  true, 'Suzuki, from the initial load, is reviewed (CA-03, RN-07)');
select is((select reviewed from public.vehicle_lines
           where id = pg_temp.line(pg_temp.brand('motorcycle', 'Suzuki'), 'GSX-R600')),
  true, 'its GSX-R600, from the initial load, is reviewed');
select is((select reviewed from public.vehicle_brands where id = pg_temp.brand('motorcycle', 'Suzuky')),
  false, '«Suzuky», typed registering a vehicle, is to review (CA-03, RN-07)');

-- Marking the initial load on «dirty» rows: one at the time of the initial load, one later.
insert into public.vehicle_brands (vehicle_type, name, created_at, reviewed)
values ('motorcycle', 'Zz Carga Inicial', (select min(created_at) from public.vehicle_brands), false),
       ('motorcycle', 'Zz Despues', now(), true);
insert into public.vehicle_lines (brand_id, name, created_at, reviewed)
values (pg_temp.brand('motorcycle', 'Zz Carga Inicial'), 'Zz Linea Inicial',
        (select min(created_at) from public.vehicle_brands), false);
select private.mark_initial_vehicle_catalog_reviewed();
select results_eq(
  $$ select name, reviewed from public.vehicle_brands where name like 'Zz %' order by name $$,
  $$ values ('Zz Carga Inicial', true), ('Zz Despues', false) $$,
  'only what has the time of the initial load starts reviewed (RF-02, RN-07)');
select is((select reviewed from public.vehicle_lines where name = 'Zz Linea Inicial'), true,
  'the lines of the initial load start reviewed too');

select is((select condeferrable from pg_constraint where conname = 'vehicles_line_fk'), true,
  'the vehicle → line key can wait to the end of a transaction (moving a line, HU-04)');
select is((select bool_and(relrowsecurity) from pg_class
           where oid in ('public.vehicle_brand_aliases'::regclass, 'public.vehicle_line_aliases'::regclass)),
  true, 'RLS is on in the remembered names');
select policies_are('public', 'vehicle_brand_aliases', array['vehicle_brand_aliases_select_authenticated'],
  'the remembered brand names are only read');
select policies_are('public', 'vehicle_line_aliases', array['vehicle_line_aliases_select_authenticated'],
  'the remembered line names are only read');
select column_privs_are('public', 'vehicle_brands', 'reviewed', 'authenticated', array[]::text[],
  'nobody reads whether a brand is reviewed from the API (RN-06, CA-06)');
select column_privs_are('public', 'vehicle_brands', 'created_at', 'authenticated', array[]::text[],
  'nor when it was added');
select column_privs_are('public', 'vehicle_brands', 'name', 'authenticated', array['SELECT'],
  'the name of a brand is still read by everyone (suggestions)');
select column_privs_are('public', 'vehicle_lines', 'reviewed', 'authenticated', array[]::text[],
  'nobody reads whether a line is reviewed from the API');
select column_privs_are('public', 'vehicle_lines', 'created_at', 'authenticated', array[]::text[],
  'nor when it was added');

set local role authenticated;
select pg_temp.act_as(:camilo_user);
select is(pg_temp.error_state($$ select reviewed from public.vehicle_brands limit 1 $$), '42501',
  'a customer cannot read whether a brand is to review (CA-06)');
select pg_temp.act_as(:admin);
select is(pg_temp.error_state($$ insert into public.vehicle_brand_aliases (vehicle_type, brand_id, name)
                               values ('motorcycle', pg_temp.brand('motorcycle', 'Suzuki'), 'x') $$),
  '42501', 'nobody writes a remembered name from the API, not even the admin');

-- RN-01, CA-05: the operator and the customer are refused by the database.
create function pg_temp.catalog_calls()
returns text[] language sql as $$
  select array[
    pg_temp.error_hint($q$ select * from public.vehicle_catalog('motorcycle') $q$),
    pg_temp.error_hint($q$ select public.rename_vehicle_brand(pg_temp.brand('motorcycle', 'Suzuky'), 'X') $q$),
    pg_temp.error_hint($q$ select public.rename_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Dos'), 'X') $q$),
    pg_temp.error_hint($q$ select public.merge_vehicle_brands(pg_temp.brand('motorcycle', 'Suzuky'), pg_temp.brand('motorcycle', 'Suzuki')) $q$),
    pg_temp.error_hint($q$ select public.merge_vehicle_lines(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Dos'), pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Uno')) $q$),
    pg_temp.error_hint($q$ select public.move_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Honda'), 'Fz Prueba'), pg_temp.brand('motorcycle', 'Yamaha')) $q$),
    pg_temp.error_hint($q$ select public.add_vehicle_brand('motorcycle', 'Nueva') $q$),
    pg_temp.error_hint($q$ select public.add_vehicle_line(pg_temp.brand('motorcycle', 'Yamaha'), 'Nueva') $q$),
    pg_temp.error_hint($q$ select public.mark_vehicle_brand_reviewed(pg_temp.brand('motorcycle', 'Suzuky')) $q$),
    pg_temp.error_hint($q$ select public.mark_vehicle_line_reviewed(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Dos')) $q$)
  ];
$$;
select pg_temp.act_as(:operator);
select is(pg_temp.catalog_calls(), array_fill('catalog_admin_only'::text, array[10]),
  'an operator can neither read the admin''s catalog nor change it (CA-05, RN-01)');
select pg_temp.act_as(:camilo_user);
select is(pg_temp.catalog_calls(), array_fill('catalog_admin_only'::text, array[10]),
  'nor can a customer');

-- T002 · Reading and renaming ---------------------------------------------------------------------------
select pg_temp.act_as(:admin);
select is(
  array(select name from public.vehicle_catalog('motorcycle')),
  array(select name from public.vehicle_catalog('motorcycle') order by private.catalog_key(name)),
  'the brands of a type come in alphabetical order (CA-01)');
select is((select vehicles from public.vehicle_catalog('motorcycle') where name = 'Suzuky'), 2,
  '«Suzuky» counts its two vehicles, the retired one too (CA-01)');
select ok((select not reviewed and created_at is not null
           from public.vehicle_catalog('motorcycle') where name = 'Suzuky'),
  'and says it is to review, and when it was added (CA-03)');
select is(
  (select jsonb_path_query_array(lines, '$[*].name')
   from public.vehicle_catalog('motorcycle') where name = 'Suzuky'),
  '["GSX-R600", "Pruebalinea Uno"]'::jsonb,
  'a brand comes with its lines, in alphabetical order (CA-02)');
select is(
  (select (l ->> 'vehicles')::int
   from public.vehicle_catalog('motorcycle') c, jsonb_array_elements(c.lines) l
   where c.name = 'Suzuky' and l ->> 'name' = 'GSX-R600'),
  1, 'each line counts its vehicles (CA-02)');
select ok(not exists (select 1 from public.vehicle_catalog('motorcycle') where name = 'GW'),
  'only the brands of the type asked for (GW is a bicycle brand)');

select is(pg_temp.report_brand('o_renamed'), 'Motorismo Mtrs', 'before: the report shows the old name');
select lives_ok($$ select public.rename_vehicle_brand(pg_temp.brand('motorcycle', 'Motorismo Mtrs'), '  Motorismo   Motors ') $$,
  'the admin renames a brand (CA-07)');
select is(
  (select b.name from public.vehicles v join public.vehicle_brands b on b.id = v.brand_id
   where v.id = pg_temp.id_of('renamed')),
  'Motorismo Motors', 'its vehicles show the new name, trimmed and with single spaces (CA-07)');
select is(pg_temp.report_brand('o_renamed'), 'Motorismo Motors', 'and so does the report (CA-07, RF-01)');
select is((select brand_name from public.work_order_summaries where id = pg_temp.id_of('o_renamed')),
  'Motorismo Motors', 'and the order (CA-07, RF-01)');
select is((select brand_name from public.reservation_summaries where id = pg_temp.id_of('r_renamed')),
  'Motorismo Motors', 'and the reservation (CA-07, RF-01)');
select pg_temp.act_as(:camilo_user);
select is((select brand_name from public.my_order_history() where id = pg_temp.id_of('o_renamed')),
  'Motorismo Motors', 'and the customer''s own history (CA-07, RF-01)');
select pg_temp.act_as(:admin);
select is((select reviewed from public.vehicle_catalog('motorcycle') where name = 'Motorismo Motors'), true,
  'a renamed brand is reviewed (CA-11, RN-07)');
select lives_ok($$ select public.rename_vehicle_brand(pg_temp.brand('motorcycle', 'KTM'), 'Ktm') $$,
  'changing only how a name is written is allowed (CA-09)');
select is((select reviewed from public.vehicle_catalog('motorcycle') where name = 'Ktm'), true,
  'and a reviewed brand stays reviewed (CA-11)');
select is(pg_temp.error_hint($$ select public.rename_vehicle_brand(pg_temp.brand('motorcycle', 'Motorismo Motors'), 'su-zuki') $$),
  'catalog_name_taken', 'a name another brand of the type has is refused (CA-09)');
select is(pg_temp.error_hint($$ select public.rename_vehicle_brand(pg_temp.brand('motorcycle', 'Motorismo Motors'), '   ') $$),
  'catalog_name_required', 'an empty name is refused (CA-10)');
select is(pg_temp.error_hint(format($$ select public.rename_vehicle_brand(pg_temp.brand('motorcycle', 'Motorismo Motors'), %L) $$, repeat('a', 61))),
  'catalog_name_too_long', 'a name over 60 characters is refused (CA-10)');
select is(pg_temp.error_hint($$ select public.rename_vehicle_brand(gen_random_uuid(), 'Nada') $$),
  'catalog_not_found', 'an unknown brand is not found');

select lives_ok($$ select public.rename_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Motorismo Motors'), 'Clasica Mtrs'), 'Clasica Motors') $$,
  'the admin renames a line (CA-08)');
select is(
  (select l.name from public.vehicles v join public.vehicle_lines l on l.id = v.line_id
   where v.id = pg_temp.id_of('renamed')),
  'Clasica Motors', 'its vehicles show the new name (CA-08)');
select is(pg_temp.error_hint($$ select public.rename_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Motorismo Motors'), 'Clasica Motors'), 'deportiva mtrs') $$),
  'catalog_name_taken', 'a name another line of the brand has is refused (CA-09)');

-- CA-16: the name before a rename, typed later, gives the renamed one (brand and line).
select pg_temp.moto('typed_old_name', 'motorismo mtrs', 'clasica mtrs', 'VCA19A');
select results_eq(
  $$ select brand_id, line_id from public.vehicles where id = pg_temp.id_of('typed_old_name') $$,
  $$ select pg_temp.brand('motorcycle', 'Motorismo Motors'),
            pg_temp.line(pg_temp.brand('motorcycle', 'Motorismo Motors'), 'Clasica Motors') $$,
  'typing the old names after a rename gives the renamed brand and line (CA-16)');

-- T003 · Merging and moving -----------------------------------------------------------------------------
create temp table t_before as select pg_temp.report_total() as total;
grant select on t_before to authenticated;
create temp table t_suzuky as
  select pg_temp.brand('motorcycle', 'Suzuky') as brand,
         pg_temp.line(pg_temp.brand('motorcycle', 'Suzuky'), 'Pruebalinea Uno') as moved_line;
grant select on t_suzuky to authenticated;

select is(public.merge_vehicle_brands(pg_temp.brand('motorcycle', 'Suzuky'), pg_temp.brand('motorcycle', 'Suzuki')),
  2, 'merging «Suzuky» into Suzuki moves its two vehicles (CA-12)');
select results_eq(
  $$ select brand_id, line_id from public.vehicles where id = pg_temp.id_of('suzuky_gsx') $$,
  $$ select pg_temp.brand('motorcycle', 'Suzuki'), pg_temp.line(pg_temp.brand('motorcycle', 'Suzuki'), 'GSX-R600') $$,
  'a line Suzuki already had merges with it: the vehicle is Suzuki GSX-R600 (CA-13)');
select results_eq(
  $$ select v.brand_id, v.line_id, v.retired_at from public.vehicles v where v.id = pg_temp.id_of('suzuky_other') $$,
  $$ select pg_temp.brand('motorcycle', 'Suzuki'), (select moved_line from t_suzuky), (select retired_at from t_retired) $$,
  'a line Suzuki did not have moves to it, with its retired vehicle and its retirement date (CA-12, CA-13)');
select ok(not exists (select 1 from public.vehicle_brands where id = (select brand from t_suzuky)),
  '«Suzuky» is no longer in the catalog (CA-12, RN-04)');
select is(pg_temp.line_reviewed((select moved_line from t_suzuky)), false,
  'a line that passed with a merged brand keeps its state: still to review (RN-07)');
select is(pg_temp.report_brand('o_suzuky'), 'Suzuki', 'the report of its order shows Suzuki (CA-17)');
select is(pg_temp.report_total(), (select total from t_before), 'and the totals do not change (CA-17)');

select pg_temp.moto('typed_merged', 'suzuky', 'gsx r600', 'VCA20A');
select results_eq(
  $$ select brand_id, line_id from public.vehicles where id = pg_temp.id_of('typed_merged') $$,
  $$ select pg_temp.brand('motorcycle', 'Suzuki'), pg_temp.line(pg_temp.brand('motorcycle', 'Suzuki'), 'GSX-R600') $$,
  'typing «Suzuky» later gives Suzuki: the merged name does not come back (CA-16)');
select is(pg_temp.error_hint($$ select public.rename_vehicle_brand(pg_temp.brand('motorcycle', 'Motorismo Motors'), 'Suzuky') $$),
  'catalog_name_taken', 'a name remembered for another brand is taken too (CA-09, RN-02)');
select is(pg_temp.error_hint($$ select public.merge_vehicle_brands(pg_temp.brand('motorcycle', 'Honda'), pg_temp.brand('bicycle', 'GW')) $$),
  'catalog_type_mismatch', 'a brand merges only with one of its type (CA-15, RN-05)');
select is(pg_temp.error_hint($$ select public.merge_vehicle_brands(pg_temp.brand('motorcycle', 'Honda'), pg_temp.brand('motorcycle', 'Honda')) $$),
  'catalog_same_item', 'never with itself (CA-15)');

select is(public.merge_vehicle_lines(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Dos'),
                                     pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Uno')),
  1, 'merging the line «Cbr Dos» into «Cbr Uno» moves its vehicle (CA-14)');
select is((select line_id from public.vehicles where id = pg_temp.id_of('cbr_two')),
  pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Uno'), 'the vehicle is now a Cbr Uno (CA-14)');
select ok(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Dos') is null, '«Cbr Dos» is gone (CA-14)');
select is(pg_temp.line_reviewed(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Uno')),
  true, 'the line that stays is reviewed (RN-07)');
select is(pg_temp.error_hint($$ select public.merge_vehicle_lines(pg_temp.line(pg_temp.brand('motorcycle', 'Honda'), 'Fz Prueba'),
                                                                  pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Uno')) $$),
  'catalog_brand_mismatch', 'a line merges only with one of its brand (CA-15)');

select is(public.move_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Honda'), 'Fz Prueba'),
                                   pg_temp.brand('motorcycle', 'Yamaha')),
  1, 'moving «Fz Prueba» from Honda to Yamaha moves its vehicle (CA-18)');
select results_eq(
  $$ select v.brand_id, l.brand_id from public.vehicles v join public.vehicle_lines l on l.id = v.line_id
     where v.id = pg_temp.id_of('fz') $$,
  $$ select pg_temp.brand('motorcycle', 'Yamaha'), pg_temp.brand('motorcycle', 'Yamaha') $$,
  'the line and its vehicle are Yamaha now (CA-18)');
select is(pg_temp.line_reviewed(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Fz Prueba')),
  true, 'and the moved line is reviewed (RN-07)');
select is(public.move_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Honda'), 'linea-igual'),
                                   pg_temp.brand('motorcycle', 'Yamaha')),
  1, 'moving a line Yamaha already has moves its vehicle too (CA-19)');
select results_eq(
  $$ select brand_id, line_id from public.vehicles where id = pg_temp.id_of('same_honda') $$,
  $$ select pg_temp.brand('motorcycle', 'Yamaha'), pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Linea Igual') $$,
  'and merges it with the one Yamaha had (CA-19)');
select is(pg_temp.error_hint($$ select public.move_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Uno'), pg_temp.brand('bicycle', 'GW')) $$),
  'catalog_type_mismatch', 'a line moves only to a brand of its type (CA-20, RN-05)');
select is(pg_temp.error_hint($$ select public.move_vehicle_line(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), 'Cbr Uno'), pg_temp.brand('motorcycle', 'Yamaha')) $$),
  'catalog_same_item', 'and not to its own brand (CA-20)');

-- HU-06 · Registering what is missing and marking reviewed --------------------------------------------------
select isnt(public.add_vehicle_brand('motorcycle', '  Voge   Prueba '), null, 'the admin registers the brand «Voge Prueba» (CA-26)');
select results_eq(
  $$ select reviewed, vehicles from public.vehicle_catalog('motorcycle') where name = 'Voge Prueba' $$,
  $$ values (true, 0) $$,
  'it is reviewed, without vehicles, its name trimmed (CA-26, RN-07)');
select pg_temp.moto('voge', 'voge prueba', 'Uno', 'VCA21A');
select is((select brand_id from public.vehicles where id = pg_temp.id_of('voge')), pg_temp.brand('motorcycle', 'Voge Prueba'),
  'registering a vehicle reuses it, as any brand of the catalog (CA-26)');
select is(pg_temp.error_hint($$ select public.add_vehicle_brand('motorcycle', 'SUZUKI') $$),
  'catalog_name_taken', 'a brand the type has is not registered twice (CA-28)');
select is(pg_temp.error_hint($$ select public.add_vehicle_brand('motorcycle', 'Suzuky') $$),
  'catalog_name_taken', 'nor a name a brand remembers (CA-28)');
select is(pg_temp.error_hint($$ select public.add_vehicle_brand('motorcycle', '') $$),
  'catalog_name_required', 'nor an empty name (CA-28)');
select isnt(public.add_vehicle_line(pg_temp.brand('motorcycle', 'Yamaha'), '525 Dsx Prueba'), null,
  'the admin registers a line of a brand (CA-27)');
select is(pg_temp.line_reviewed(pg_temp.line(pg_temp.brand('motorcycle', 'Yamaha'), '525 Dsx Prueba')),
  true, 'it is reviewed (CA-27, RN-07)');
select is(pg_temp.error_hint($$ select public.add_vehicle_line(pg_temp.brand('motorcycle', 'Yamaha'), 'cbr-uno') $$),
  'catalog_name_taken', 'a line the brand has is not registered twice (CA-28)');
select is(pg_temp.error_hint($$ select public.add_vehicle_line(gen_random_uuid(), 'Nada') $$),
  'catalog_not_found', 'nor a line of an unknown brand');

select pg_temp.moto('well_written', 'Marca Bien Escrita', 'Linea Bien Escrita', 'VCA22A');
select lives_ok($$ select public.mark_vehicle_brand_reviewed(pg_temp.brand('motorcycle', 'Marca Bien Escrita')) $$,
  'the admin marks a well written brand reviewed (CA-29)');
select lives_ok($$ select public.mark_vehicle_line_reviewed(pg_temp.line(pg_temp.brand('motorcycle', 'Marca Bien Escrita'), 'Linea Bien Escrita')) $$,
  'and its line (CA-29)');
select results_eq(
  $$ select c.reviewed, (c.lines -> 0 ->> 'reviewed')::boolean
     from public.vehicle_catalog('motorcycle') c where c.name = 'Marca Bien Escrita' $$,
  $$ values (true, true) $$,
  'both are no longer to review (CA-29)');
select is(pg_temp.error_hint($$ select public.mark_vehicle_brand_reviewed(gen_random_uuid()) $$),
  'catalog_not_found', 'an unknown brand is not found');

reset role;
-- RN-02: no remembered name equal to a live one, after everything above.
select ok(not exists (
  select 1 from public.vehicle_brand_aliases a
  join public.vehicle_brands b on b.vehicle_type = a.vehicle_type and b.name_key = a.name_key),
  'no remembered brand name equals a live brand of its type (RN-02)');
select ok(not exists (
  select 1 from public.vehicle_line_aliases a
  join public.vehicle_lines l on l.brand_id = a.brand_id and l.name_key = a.name_key),
  'no remembered line name equals a live line of its brand (RN-02)');

-- The exception of the guard is narrow: only the brand and the line of a retired vehicle.
select set_config('motorismo.recataloging', 'on', true);
select is(pg_temp.error_hint($$ update public.vehicles set color = 'red' where id = pg_temp.id_of('suzuky_other') $$),
  'vehicle_retired', 'a retired vehicle still refuses any other change while recataloging');
select set_config('motorismo.recataloging', 'off', true);

select * from finish();
rollback;
