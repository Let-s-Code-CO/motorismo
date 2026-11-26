-- Motorcycle categories and prices by category (spec 024).
--
-- * Eight categories (RF-01). A catalog line of motorcycle has one, set only by an admin (CA-01); a
--   motorcycle takes its line's (CA-02) unless staff gave it its own (CA-03, RN-04); a customer never
--   sets it (CA-05, RN-03). A line people add later has none (CA-18).
-- * A service's motorcycle value is single or one per category, all eight or none (RF-02, CA-07,
--   CA-08); a service may be «a convenir» (on quote): no values nor time, for any vehicle (RF-03,
--   CA-12); and carry a description of up to 300 characters (CA-19).
-- * An order line takes the value of the motorcycle's category; without a category it is refused; a
--   service on quote needs the value written; a saved line keeps its value (CA-06, CA-10, CA-11,
--   CA-13, RN-01, RN-02).
-- * A reservation keeps the time staff give a service on quote, and sums it (CA-14); a customer
--   cannot book one, and is not offered it (CA-16).
-- * The business's price list and the categories of the initial lines come loaded (CA-17, CA-18).
--
-- The clock is fixed through private.agenda_now(): Wednesday 12 June 2030, 8:00.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

create or replace function private.agenda_now()
returns timestamptz language sql stable set search_path = '' as $$
  select '2030-06-12 08:00-05'::timestamptz;
$$;

create function pg_temp.new_staff(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role) values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', '{}');
  update public.profiles set status = 'active' where id = p_id;
end $$;
create function pg_temp.new_customer(p_id uuid, p_email text, p_name text)
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                          raw_user_meta_data, email_confirmed_at, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', p_name, 'data_consent', true), now(), now());
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

create temp table t_ids (name text primary key, id uuid not null);
grant select, insert on t_ids to authenticated;
create function pg_temp.remember(p_name text, p_id uuid)
returns uuid language sql as $$ insert into t_ids values (p_name, p_id) returning id; $$;
create function pg_temp.id_of(p_name text)
returns uuid language sql stable as $$ select id from t_ids where name = p_name; $$;

/** Eight values of the list, in the order of the categories. */
create function pg_temp.prices(p_street int, p_sbk int, p_scooter int, p_maxi_scooter int, p_trail int,
                               p_maxi_trail int, p_cruiser int, p_maxi_cruiser int)
returns jsonb language sql immutable as $$
  select jsonb_build_object('street', p_street, 'sbk', p_sbk, 'scooter', p_scooter, 'maxi_scooter', p_maxi_scooter,
                            'trail', p_trail, 'maxi_trail', p_maxi_trail, 'cruiser', p_cruiser,
                            'maxi_cruiser', p_maxi_cruiser);
$$;

-- Independent of the seeds' reservations and agenda.
delete from public.reservation_extensions;
delete from public.reservation_services;
delete from public.reservations;
delete from public.agenda_days;
delete from public.agenda_weeks;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000024a1', 'pc-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000024b1', 'pc-op@test.local', 'Omar Operador', 'operator');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000024c1', 'pc-camilo@test.local', 'Camilo Cliente');
select pg_temp.remember('camilo', id) from public.customers where email = 'pc-camilo@test.local';

-- The categories (RF-01) ----------------------------------------------------------------------------------
select enum_has_labels('public', 'motorcycle_category',
  array['street', 'sbk', 'scooter', 'maxi_scooter', 'trail', 'maxi_trail', 'cruiser', 'maxi_cruiser'],
  'RF-01: the eight categories, in the order of the list');
select has_column('public', 'vehicle_lines', 'motorcycle_category', 'CA-01: a line has its category');
select has_column('public', 'vehicles', 'motorcycle_category', 'CA-03: a motorcycle may have its own');
select throws_ok(
  $$ update public.vehicle_lines set motorcycle_category = 'trail'
     where brand_id = (select id from public.vehicle_brands where vehicle_type = 'car' and name = 'Mazda')
       and name = 'CX-30'
     returning 1 $$,
  '23514', null, 'RF-01: only a motorcycle line has a category');

-- The loaded data (CA-17, CA-18) ---------------------------------------------------------------------------
select is((select count(*)::int from public.vehicle_lines l join public.vehicle_brands b on b.id = l.brand_id
           where b.vehicle_type = 'motorcycle' and l.motorcycle_category is not null), 173,
  'CA-18: the 173 motorcycle lines of the initial catalog come with their category');
select is((select l.motorcycle_category::text from public.vehicle_lines l join public.vehicle_brands b on b.id = l.brand_id
           where b.name = 'BMW' and l.name = 'R 1250 GS'), 'maxi_trail',
  'CA-18: an R 1250 GS is Maxi Trail');
select is((select l.motorcycle_category::text from public.vehicle_lines l join public.vehicle_brands b on b.id = l.brand_id
           where b.name = 'Bajaj' and l.name = 'Pulsar NS 200'), 'street',
  'CA-18: a Pulsar NS 200 is Street/Roadster');
select is((select (motorcycle_prices ->> 'maxi_trail')::int from public.services where name = 'Lavado Pro Wash'),
  52000, 'CA-17: «Lavado Pro Wash» of a Maxi Trail, $ 52.000');
select is((select (motorcycle_prices ->> 'scooter')::int from public.services where name = 'Combo de lavado Supreme'),
  750000, 'CA-17: «Combo de lavado Supreme» of a Scooter, $ 750.000');
select results_eq(
  $$ select price_motorcycle, estimated_minutes::int from public.services
     where name in ('Limpieza de asientos', 'Paquete de lavado Premium') order by name $$,
  $$ values (16000, null::int), (null, 120) $$,
  'CA-17: a single value (asientos, $ 16.000) and the time of a package (Premium, 2 h)');
select results_eq(
  $$ select on_quote, price_motorcycle, price_car, price_bicycle, motorcycle_prices, estimated_minutes::int
     from public.services where name = 'PPF' $$,
  $$ values (true, null::int, null::int, null::int, null::jsonb, null::int) $$,
  'CA-17: «PPF» comes on quote');
select is((select count(*)::int from public.services where name in (
  'Lavado Pro Wash', 'Paquete de lavado Premium', 'Combo de lavado Deluxe', 'Combo de lavado Supreme',
  'Limpieza de asientos', 'Sellador', 'Desengrasado de cadena', 'Lubricado de cadena',
  'Desengrasado y lubricado de cadena', 'Limpieza completa de kit con tapa piñón',
  'Limpieza completa de kit con tapa piñón y cubrecadena', 'PPF')), 12,
  'CA-17: the twelve services of the list');

-- Services (CA-07, CA-08, CA-12, CA-19) --------------------------------------------------------------------
select lives_ok(
  $$ insert into public.services (name, motorcycle_prices, estimated_minutes)
     values ('PC Lavado', pg_temp.prices(10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000), 30) $$,
  'CA-07: a service with a value for each category');
select throws_ok(
  $$ insert into public.services (name, motorcycle_prices)
     values ('PC Siete', pg_temp.prices(10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000) - 'maxi_cruiser') $$,
  '23514', null, 'CA-08: never seven of the eight');
select throws_ok(
  $$ insert into public.services (name, motorcycle_prices)
     values ('PC Cero', pg_temp.prices(0, 11000, 12000, 13000, 14000, 15000, 16000, 17000)) $$,
  '23514', null, 'CA-08: each value from $ 1');
select throws_ok(
  $$ insert into public.services (name, price_motorcycle, motorcycle_prices)
     values ('PC Doble', 20000, pg_temp.prices(10000, 11000, 12000, 13000, 14000, 15000, 16000, 17000)) $$,
  '23514', null, 'CA-07: a single value or one per category, never both');
select lives_ok(
  $$ insert into public.services (name, on_quote) values ('PC PPF', true) $$,
  'CA-12: a service on quote, without values');
select throws_ok(
  $$ insert into public.services (name, on_quote, price_car) values ('PC PPF caro', true, 90000) $$,
  '23514', null, 'CA-12: a service on quote has no values');
select throws_ok(
  $$ insert into public.services (name, on_quote, estimated_minutes) values ('PC PPF largo', true, 60) $$,
  '23514', null, 'CA-12: nor a time');
select throws_ok(
  $$ insert into public.services (name, price_motorcycle, description) values ('PC Largo', 1000, repeat('a', 301)) $$,
  '23514', null, 'CA-19: a description of up to 300 characters');
insert into public.services (name, price_motorcycle, description) values ('PC Asientos', 16000, 'Se retiran los asientos.');
-- Their ids, for the steps run as a customer (who cannot read the catalog).
select pg_temp.remember(name, id) from public.services where name in ('PC Lavado', 'PC PPF', 'PC Asientos');

-- The category of a motorcycle (CA-01 to CA-06) -------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000024b1');
select pg_temp.remember('moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'PCA12B'));
select pg_temp.remember('moto_own', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'white', p_plate => 'PCB12B',
  p_motorcycle_category => 'street', p_set_category => true));
select pg_temp.remember('moto_new', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'PC Nueva 300', p_color => 'red', p_plate => 'PCC12B'));
reset role;
select is(private.vehicle_category(pg_temp.id_of('moto'))::text, 'sbk',
  'CA-02: a GSX-R600 takes the category of its line, SBK/SSP');
select is(private.vehicle_category(pg_temp.id_of('moto_own'))::text, 'street',
  'CA-03: staff may give a motorcycle its own');
select is(private.vehicle_category(pg_temp.id_of('moto_new')), null,
  'CA-18: a line people add has no category, nor its motorcycle');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000024b1');
select is(pg_temp.error_hint($$ select public.set_vehicle_line_category(
       (select id from public.vehicle_lines where name = 'GSX-R600'), 'street') $$), 'catalog_admin_only',
  'CA-01: an operator does not set a line''s category');
select pg_temp.act_as('00000000-0000-0000-0000-0000000024a1');
select lives_ok($$ select public.set_vehicle_line_category(
       (select id from public.vehicle_lines where name = 'GSX-R600'), 'trail') $$,
  'CA-01: an admin does');
reset role;
select results_eq(
  $$ select private.vehicle_category(pg_temp.id_of('moto'))::text, private.vehicle_category(pg_temp.id_of('moto_own'))::text $$,
  $$ values ('trail', 'street') $$,
  'CA-03, RN-04: the motorcycle that follows its line changes with it; the one with its own keeps it');
select is((select reviewed from public.vehicle_lines where name = 'PC Nueva 300'), false,
  'CA-18: the new line is still to review');

-- A customer never sets it (CA-05, RN-03).
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000024c1');
select is(pg_temp.error_hint(format($$ select public.save_vehicle(
       p_customer_id => %L, p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki', p_line_name => 'GSX-R600',
       p_color => 'black', p_plate => 'PCA12B', p_vehicle_id => %L,
       p_motorcycle_category => 'scooter', p_set_category => true) $$,
       pg_temp.id_of('camilo'), pg_temp.id_of('moto'))), 'vehicle_category_staff_only',
  'CA-05: a customer does not set their motorcycle''s category');
select lives_ok(format($$ select public.save_vehicle(
       p_customer_id => %L, p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki', p_line_name => 'GSX-R600',
       p_color => 'blue', p_plate => 'PCB12B', p_vehicle_id => %L) $$,
       pg_temp.id_of('camilo'), pg_temp.id_of('moto_own')),
  'CA-05: but corrects their motorcycle without touching it');
select is(pg_temp.error_hint(format($$ select public.set_vehicle_category(%L, 'scooter') $$, pg_temp.id_of('moto'))),
  'vehicle_category_staff_only', 'CA-05: nor through the order''s function');
reset role;
select is(private.vehicle_category(pg_temp.id_of('moto_own'))::text, 'street',
  'CA-05: the category the staff gave stays');

-- An order (CA-06, CA-10, CA-11, CA-13, RN-01, RN-02) -------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000024b1');
select pg_temp.remember('o_moto', public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
  jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'PC Lavado')),
                    jsonb_build_object('service_id', (select id from public.services where name = 'PC Asientos')))));
select results_eq(
  $$ select name, price from public.work_order_lines where work_order_id = pg_temp.id_of('o_moto') order by position $$,
  $$ values ('PC Lavado'::text, 14000), ('PC Asientos'::text, 16000) $$,
  'CA-10: the value of the motorcycle''s category (Trail, $ 14.000), and a single value');
select is(pg_temp.error_hint(format($$ select public.save_work_order(%L, %L, %L) $$,
       pg_temp.id_of('camilo'), pg_temp.id_of('moto_new'),
       jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'PC Lavado'))))),
  'work_order_category_required', 'CA-06: a motorcycle without category, a service by category: refused');
select is(pg_temp.error_hint(format($$ select public.save_work_order(%L, %L, %L) $$,
       pg_temp.id_of('camilo'), pg_temp.id_of('moto_new'),
       jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'PC PPF'))))),
  'work_order_price_required', 'CA-13, RN-02: a service on quote needs its value');
select lives_ok(format($$ select pg_temp.remember('o_ppf', public.save_work_order(%L, %L, %L)) $$,
       pg_temp.id_of('camilo'), pg_temp.id_of('moto_new'),
       jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'PC PPF'),
                                            'price', 1200000, 'estimated_minutes', 480))),
  'CA-13: with its value written, for a motorcycle without category');
select lives_ok(format($$ select public.set_vehicle_category(%L, 'maxi_trail') $$, pg_temp.id_of('moto_new')),
  'CA-06: staff give it its category from the order');
reset role;
select is(private.vehicle_category(pg_temp.id_of('moto_new'))::text, 'maxi_trail',
  'CA-06: and it is kept on the motorcycle');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000024b1');
select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
  (select jsonb_agg(jsonb_build_object('id', id) order by position) from public.work_order_lines
   where work_order_id = pg_temp.id_of('o_moto'))
  || jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'PC Lavado'))),
  p_id => pg_temp.id_of('o_moto'));
reset role;
update public.vehicles set motorcycle_category = 'maxi_cruiser' where id = pg_temp.id_of('moto');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000024b1');
select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
  (select jsonb_agg(jsonb_build_object('id', id) order by position) from public.work_order_lines
   where work_order_id = pg_temp.id_of('o_moto'))
  || jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'PC Lavado'))),
  p_id => pg_temp.id_of('o_moto'));
select results_eq(
  $$ select price from public.work_order_lines where work_order_id = pg_temp.id_of('o_moto') and name = 'PC Lavado'
     order by position $$,
  $$ values (14000), (14000), (17000) $$,
  'CA-11, RN-01: lines already added keep their value; the one added after the change takes Maxi Cruiser''s');

-- A reservation (CA-14, CA-16) ------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000024a1');
select public.save_agenda_week('2030-06-10', (
  select jsonb_agg(jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '18:00') order by i)
  from generate_series(0, 6) as i), true);
select pg_temp.act_as('00000000-0000-0000-0000-0000000024b1');
select is(pg_temp.error_hint(format($$ select public.save_reservation(%L, %L, '2030-06-13 10:00-05', %L) $$,
       pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
       array[(select id from public.services where name = 'PC PPF')])),
  'reservation_quoted_minutes_required', 'CA-14: staff give the time of a service on quote');
select pg_temp.remember('r_ppf', public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
  '2030-06-13 10:00-05',
  array[(select id from public.services where name = 'PC Lavado'), (select id from public.services where name = 'PC PPF')],
  p_service_minutes => jsonb_build_object((select id from public.services where name = 'PC PPF'), 240)));
select results_eq(
  $$ select estimated_minutes, unestimated from public.reservation_summaries where id = pg_temp.id_of('r_ppf') $$,
  $$ values (270, '{}'::text[]) $$,
  'CA-14: the reservation sums it: 30 min of «PC Lavado» + 240 of «PC PPF» = 270');
select pg_temp.act_as('00000000-0000-0000-0000-0000000024c1');
select is(pg_temp.error_hint(format($$ select public.save_reservation(%L, %L, '2030-06-14 10:00-05', %L) $$,
       pg_temp.id_of('camilo'), pg_temp.id_of('moto'), array[pg_temp.id_of('PC PPF')])),
  'reservation_service_quoted', 'CA-16: a customer cannot book a service on quote');
select is((select count(*)::int from public.bookable_services() where name in ('PC PPF', 'PPF')), 0,
  'CA-16: nor is offered one');
select is((select motorcycle from public.bookable_services() where name = 'PC Lavado'), true,
  'CA-16: a service by category is offered for motorcycles');
reset role;

-- Who may (RN-03) -----------------------------------------------------------------------------------------
select function_privs_are('public', 'set_vehicle_category', array['uuid', 'public.motorcycle_category'], 'anon',
  array[]::text[], 'anon cannot set a category');

select * from finish();
rollback;
