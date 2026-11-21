-- reservations — the car wash's agenda: a seat kept for a customer in a slot (spec 012).
--
-- The admin enables the agenda week by week (Monday to Sunday), each day open with its hours or
-- closed (CA-26 to CA-28, RN-10), and sets the slot length, the seats per slot and the arrival
-- tolerance (CA-29). Staff book a seat in a slot that has not started, of an open day of an enabled
-- week (RN-01), never over the seats (RN-02); a vehicle has one pending reservation per slot (RN-03).
-- Every write goes through functions that apply the rules in one place:
--   * save_agenda_week / save_agenda_settings: admin only (CA-32); a day must hold a full slot
--     (CA-30); ranges (CA-29);
--   * save_reservation: books (CA-01 to CA-08) or moves a pending one (CA-20);
--   * cancel_reservation (CA-21), mark_reservation_no_show once its tolerance has passed (CA-22),
--     set_reservation_tolerance, admin only (CA-24, CA-25); nothing changes a reservation that is
--     no longer pending (CA-23);
--   * save_work_order with a reservation: the customer arrived, today (CA-19). The order gets its
--     turn (RN-04: the reserved time if they arrive within the tolerance, CA-15 to CA-17) and the
--     reservation is attended, linked to it (CA-13).
-- Reservations already made keep their time when the hours or the settings change, and the summary
-- view flags them (CA-31). Nobody writes the tables directly or deletes; a customer reads nothing
-- (RN-05, RN-06).
--
-- The clock: everything that looks at the time asks private.agenda_now(). Here it reads the
-- setting `test.now`, so each step happens at a fixed time of Wednesday 12 June 2030 (Bogotá),
-- whatever time the tests run (undone by the final rollback).
begin;
create extension if not exists pgtap with schema extensions;

select plan(111);

-- Clock and fixtures ---------------------------------------------------------------------------
create or replace function private.agenda_now()
returns timestamptz language sql stable set search_path = '' as $$
  select current_setting('test.now')::timestamptz;
$$;
create function pg_temp.at(p_local text)
returns void language sql as $$ select set_config('test.now', p_local || '-05', true); $$;
-- A time of a day of the test week, in Bogotá: pg_temp.ts('12', '09:00').
create function pg_temp.ts(p_day text, p_time text)
returns timestamptz language sql immutable as $$ select ('2030-06-' || p_day || ' ' || p_time || '-05')::timestamptz; $$;

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

-- Seven days of a week, each [open, opens, closes]; the default is the proposal (RN-10).
create function pg_temp.week(p_overrides jsonb default '{}')
returns jsonb language sql immutable as $$
  select jsonb_agg(coalesce(p_overrides -> i::text,
                            jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '18:00'))
                   order by i)
  from generate_series(0, 6) as i;
$$;
create function pg_temp.lines(p_service text)
returns jsonb language sql stable as $$
  select jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of(p_service)));
$$;
-- The taken seats of the slot that starts at that time.
create function pg_temp.taken(p_day text, p_time text)
returns int language sql stable as $$
  select taken from public.agenda_slots(('2030-06-' || p_day)::date) where slot_start = pg_temp.ts(p_day, p_time);
$$;

-- Independent of the seeds: no reservations, agenda or orders to start with.
delete from public.reservation_services;
delete from public.reservations;
delete from public.agenda_days;
delete from public.agenda_weeks;
delete from public.work_order_payments;
delete from public.work_order_line_employees;
delete from public.work_order_lines;
delete from public.work_orders;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000012a1', 'rs-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000012b1', 'rs-op@test.local', 'Oscar Operador', 'operator');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000012c1', 'rs-camilo@test.local', 'Camilo Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000012c2', 'rs-carla@test.local', 'Carla Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000012c3', 'rs-dario@test.local', 'Darío Desactivado');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000012c4', 'rs-pablo@test.local', 'Pablo Pronto');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000012c5', 'rs-lucia@test.local', 'Lucía Llegada');
select pg_temp.remember(split_part(split_part(email, '@', 1), '-', 2), id)
  from public.customers where email like 'rs-%@test.local';
-- CA-02: a customer registered at the counter, without account (spec 004).
insert into public.customers (full_name, phone, origin, registered_by)
values ('Wendy Walkin', '3001234567', 'counter', '00000000-0000-0000-0000-0000000012b1');
select pg_temp.remember('wendy', (select id from public.customers where full_name = 'Wendy Walkin'));

insert into public.services (name, price_motorcycle, price_car, estimated_minutes) values
  ('RS Lavado', 25000, 40000, 30), ('RS Cadena', 15000, null, null), ('RS Viejo', 10000, 10000, 15);
update public.services set disabled_at = now() where name = 'RS Viejo';
select pg_temp.remember(name, id) from public.services where name like 'RS %';

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select pg_temp.remember('camilo_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'RSA12B'));
select pg_temp.remember('camilo_old', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha',
  p_line_name => 'BWS FI', p_color => 'blue', p_plate => 'RSB12C'));
select pg_temp.remember('carla_car', public.save_vehicle(
  p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'utility', p_brand_name => 'Mazda',
  p_line_name => 'CX-30', p_color => 'gray', p_plate => 'RSC123', p_plate_city_code => '11001'));
select pg_temp.remember('dario_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('dario'), p_vehicle_type => 'motorcycle', p_brand_name => 'AKT',
  p_line_name => 'NKD 125', p_color => 'red', p_plate => 'RSD12E'));
select pg_temp.remember('pablo_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('pablo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Honda',
  p_line_name => 'CB 190R', p_color => 'white', p_plate => 'RSE12F'));
select pg_temp.remember('lucia_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('lucia'), p_vehicle_type => 'motorcycle', p_brand_name => 'Bajaj',
  p_line_name => 'Pulsar NS 200', p_color => 'red', p_plate => 'RSF12G'));
reset role;
update public.vehicles set retired_at = now() where id = pg_temp.id_of('camilo_old');
update public.customers set disabled_at = now() where id = pg_temp.id_of('dario');

-- Shape and access ---------------------------------------------------------------------------------
select has_table('public', 'agenda_settings', 'the agenda settings table exists');
select has_table('public', 'agenda_weeks', 'the agenda weeks table exists');
select has_table('public', 'agenda_days', 'the agenda days table exists');
select has_table('public', 'reservations', 'the reservations table exists');
select has_table('public', 'reservation_services', 'the reservation services table exists');
select has_view('public', 'reservation_summaries', 'the reservation summaries view exists');
select enum_has_labels('public', 'reservation_status', array['pending', 'attended', 'cancelled', 'no_show'],
  'RF-02: a reservation is pending, attended, cancelled or a no-show');
select has_column('public', 'work_orders', 'turn_at', 'RN-04: an order has its turn time');
select has_function('public', 'save_work_order',
  array['uuid', 'uuid', 'jsonb', 'integer', 'text', 'uuid', 'uuid'],
  'save_work_order takes the reservation the customer arrived with');
select results_eq(
  $$ select slot_minutes::int, seats::int, tolerance_minutes::int from public.agenda_settings $$,
  $$ values (60, 2, 15) $$,
  'the business starts with one-hour slots, 2 seats and 15 minutes of tolerance');
select throws_ok($$ update public.agenda_settings set slot_minutes = 50 $$, '23514', null,
  'CA-29: a slot lasts a multiple of 15 minutes');
select throws_ok($$ update public.agenda_settings set seats = 21 $$, '23514', null,
  'CA-29: at most 20 seats');
select throws_ok($$ update public.agenda_settings set tolerance_minutes = 61 $$, '23514', null,
  'CA-29: at most 60 minutes of tolerance');
select throws_ok($$ insert into public.agenda_weeks (week_start) values ('2030-06-11') $$, '23514', null,
  'RF-06: a week starts on Monday');
insert into public.agenda_weeks (week_start) values ('2030-07-01');
select throws_ok(
  $$ insert into public.agenda_days (day, week_start) values ('2030-07-08', '2030-07-01') $$,
  '23514', null, 'a day belongs to its own week');
select throws_ok(
  $$ insert into public.agenda_days (day, week_start, opens_at, closes_at) values ('2030-07-02', '2030-07-01', '10:00', '09:00') $$,
  '23514', null, 'CA-30: a day closes after it opens');
select throws_ok(
  $$ insert into public.reservations (customer_id, slot_start, slot_end, created_by)
     values (pg_temp.id_of('camilo'), pg_temp.ts('12', '10:00'), pg_temp.ts('12', '09:00'),
             '00000000-0000-0000-0000-0000000012b1') $$,
  '23514', null, 'a slot ends after it starts');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.agenda_settings'::regclass, 'public.agenda_weeks'::regclass, 'public.agenda_days'::regclass,
    'public.reservations'::regclass, 'public.reservation_services'::regclass)),
  'RLS is on in every agenda table');
select is_empty(
  $$ select table_name, privilege_type from information_schema.role_table_grants
     where grantee = 'authenticated' and privilege_type <> 'SELECT'
       and table_schema = 'public'
       and table_name in ('agenda_settings', 'agenda_weeks', 'agenda_days', 'reservations',
                          'reservation_services', 'reservation_summaries') $$,
  'RN-05, CA-23: signed-in users only read the agenda; they never write or delete it directly');
select is_empty(
  $$ select table_name from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'
       and table_name in ('agenda_settings', 'agenda_weeks', 'agenda_days', 'reservations',
                          'reservation_services', 'reservation_summaries') $$,
  'anon has no access to the agenda');
select function_privs_are('public', 'save_reservation',
  array['uuid', 'uuid', 'timestamp with time zone', 'uuid[]', 'text', 'uuid'], 'anon', array[]::text[],
  'anon cannot book');

-- The turn (RN-04): a reservation keeps its reserved time within the tolerance ---------------------
select is(private.reservation_turn_at(pg_temp.ts('12', '08:45'), pg_temp.ts('12', '09:00'), 15),
  pg_temp.ts('12', '08:45'), 'CA-17: arriving early, the turn is the arrival (it is already earlier)');
select is(private.reservation_turn_at(pg_temp.ts('12', '09:00'), pg_temp.ts('12', '09:00'), 15),
  pg_temp.ts('12', '09:00'), 'arriving on time, the turn is the reserved time');
select is(private.reservation_turn_at(pg_temp.ts('12', '09:10'), pg_temp.ts('12', '09:00'), 15),
  pg_temp.ts('12', '09:00'), 'CA-16: 10 minutes late with 15 of tolerance keeps 9:00');
select is(private.reservation_turn_at(pg_temp.ts('12', '09:15'), pg_temp.ts('12', '09:00'), 15),
  pg_temp.ts('12', '09:00'), 'CA-16: exactly at the end of the tolerance (9:00 + 15) still keeps 9:00');
select is(private.reservation_turn_at(pg_temp.ts('12', '09:40'), pg_temp.ts('12', '09:00'), 15),
  pg_temp.ts('12', '09:40'), 'CA-16: 40 minutes late, past the tolerance, the turn is the arrival');
select is(private.reservation_turn_at(pg_temp.ts('12', '09:01'), pg_temp.ts('12', '09:00'), 0),
  pg_temp.ts('12', '09:01'), 'with no tolerance, one minute late is already the arrival');

-- The week (HU-05) -----------------------------------------------------------------------------------
select pg_temp.at('2030-06-12 08:00');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select is(pg_temp.error_hint($$ select public.save_agenda_week('2030-06-10', pg_temp.week(), true) $$),
  'agenda_admin_only', 'CA-32: an operator cannot enable a week');
select is(pg_temp.error_hint($$ select public.save_agenda_settings(60, 3, 15) $$),
  'agenda_admin_only', 'CA-32: an operator cannot change the settings');

select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');
select lives_ok($$ select public.save_agenda_week('2030-06-10', pg_temp.week(), true) $$,
  'CA-26: the admin enables the week of 10 to 16 June with every day from 9:00 to 18:00');
select is((select count(*)::int from public.agenda_days where week_start = '2030-06-10'), 7,
  'the week has its seven days');
-- CA-27: Thursday until 17:30, Saturday until 13:00, Sunday closed.
select lives_ok(
  $$ select public.save_agenda_week('2030-06-10', pg_temp.week(jsonb_build_object(
       '3', jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '17:30'),
       '5', jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '13:00'),
       '6', jsonb_build_object('is_open', false, 'opens_at', '09:00', 'closes_at', '18:00'))), true) $$,
  'CA-27: the admin shortens two days and closes Sunday');
select results_eq(
  $$ select day, is_open, closes_at from public.agenda_days where week_start = '2030-06-10' order by day $$,
  $$ values ('2030-06-10'::date, true, '18:00'::time), ('2030-06-11', true, '18:00'), ('2030-06-12', true, '18:00'),
            ('2030-06-13', true, '17:30'), ('2030-06-14', true, '18:00'), ('2030-06-15', true, '13:00'),
            ('2030-06-16', false, '18:00') $$,
  'CA-27: only the changed days change');
select is(pg_temp.error_hint($$ select public.save_agenda_week('2030-06-10', pg_temp.week(jsonb_build_object(
       '1', jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '09:00'))), true) $$),
  'agenda_day_invalid:2030-06-11', 'CA-30: a day that closes when it opens is refused, naming the day');
select is(pg_temp.error_hint($$ select public.save_agenda_week('2030-06-10', pg_temp.week(jsonb_build_object(
       '1', jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '09:30'))), true) $$),
  'agenda_day_invalid:2030-06-11', 'CA-30: a day too short for one full slot (30 < 60 minutes) is refused');
select is(pg_temp.error_hint($$ select public.save_agenda_week('2030-06-11', pg_temp.week(), true) $$),
  'agenda_week_invalid', 'a week starts on Monday');
select is(pg_temp.error_hint($$ select public.save_agenda_settings(50, 2, 15) $$),
  'agenda_settings_out_of_range', 'CA-29: a slot of 50 minutes is refused');
select is(pg_temp.error_hint($$ select public.save_agenda_settings(60, 0, 15) $$),
  'agenda_settings_out_of_range', 'CA-29: 0 seats is refused');
select is(pg_temp.error_hint($$ select public.save_agenda_settings(60, 2, 61) $$),
  'agenda_settings_out_of_range', 'CA-29: 61 minutes of tolerance is refused');

-- The slots of a day (CA-03) -------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select results_eq(
  $$ select count(*)::int, min(slot_start), max(slot_end), bool_or(started) from public.agenda_slots('2030-06-12') $$,
  $$ values (9, pg_temp.ts('12', '09:00'), pg_temp.ts('12', '18:00'), false) $$,
  'CA-03: Wednesday has 9 one-hour slots (9:00 to 18:00), none started at 8:00');
select results_eq(
  $$ select count(*)::int, max(slot_end) from public.agenda_slots('2030-06-13') $$,
  $$ values (8, pg_temp.ts('13', '17:00')) $$,
  'RN-01: open until 17:30, only full slots count: the last one ends at 17:00 (8 slots)');
select is((select count(*)::int from public.agenda_slots('2030-06-16')), 0, 'CA-03: a closed day has no slots');
select is((select count(*)::int from public.agenda_slots('2030-06-19')), 0,
  'CA-03: a day of a week not enabled has no slots');

-- Booking (HU-01) ---------------------------------------------------------------------------------------
select lives_ok(
  $$ select pg_temp.remember('r_camilo9', public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('12', '09:00'), array[pg_temp.id_of('RS Lavado')], ' Trae un rayón ')) $$,
  'CA-05: staff book Camilo at 9:00 with a service');
select results_eq(
  $$ select status::text, created_by, slot_end, notes from public.reservations where id = pg_temp.id_of('r_camilo9') $$,
  $$ values ('pending', '00000000-0000-0000-0000-0000000012b1'::uuid, pg_temp.ts('12', '10:00'), 'Trae un rayón') $$,
  'CA-05: the reservation is pending, records who made it and ends with its slot');
select is(pg_temp.taken('12', '09:00'), 1, 'CA-05: it takes a seat of its slot');
select lives_ok(
  $$ select pg_temp.remember('r_carla9', public.save_reservation(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
       pg_temp.ts('12', '09:00'), '{}', null)) $$,
  'a second reservation at 9:00 takes the second seat');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('wendy'), null, pg_temp.ts('12', '09:00'), '{}', null) $$),
  'reservation_slot_full', 'RN-02: with both seats taken, the slot is full');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('12', '09:00'), '{}', null) $$),
  'reservation_vehicle_taken', 'CA-08: the same vehicle cannot have two pending reservations in a slot');
select lives_ok(
  $$ select pg_temp.remember('r_camilo11', public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('12', '11:00'), '{}', null)) $$,
  'CA-08: in another slot, the same vehicle can be booked');
select lives_ok(
  $$ select pg_temp.remember('r_wendy10', public.save_reservation(pg_temp.id_of('wendy'), null,
       pg_temp.ts('12', '10:00'), array[pg_temp.id_of('RS Cadena'), pg_temp.id_of('RS Lavado')], null)) $$,
  'CA-01, CA-02: a counter customer is booked without a vehicle');
select results_eq(
  $$ select services from public.reservation_summaries where id = pg_temp.id_of('r_wendy10') $$,
  $$ values (array['RS Cadena', 'RS Lavado']) $$,
  'CA-04: without a vehicle, any active service, kept in order');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('dario'), pg_temp.id_of('dario_moto'),
       pg_temp.ts('12', '12:00'), '{}', null) $$),
  'reservation_customer_disabled', 'CA-07: a disabled customer cannot be booked');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_old'),
       pg_temp.ts('12', '12:00'), '{}', null) $$),
  'reservation_vehicle_retired', 'CA-07: a retired vehicle cannot be booked');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('carla_car'),
       pg_temp.ts('12', '12:00'), '{}', null) $$),
  'reservation_vehicle_invalid', 'another customer''s vehicle cannot be booked');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('12', '12:00'), array[pg_temp.id_of('RS Viejo')], null) $$),
  'reservation_service_inactive', 'CA-04: an inactive service is not booked');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
       pg_temp.ts('12', '12:00'), array[pg_temp.id_of('RS Cadena')], null) $$),
  'reservation_service_unavailable', 'CA-04: a service without a price for a car is not booked for one');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('16', '09:00'), '{}', null) $$),
  'reservation_day_closed', 'CA-03: a closed day cannot be booked');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('19', '09:00'), '{}', null) $$),
  'reservation_week_disabled', 'CA-03: a week not enabled cannot be booked');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('12', '09:30'), '{}', null) $$),
  'reservation_slot_invalid', 'RN-01: only the start of a slot can be booked');

-- CA-03: a slot that has started.
select pg_temp.at('2030-06-12 10:05');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'),
       pg_temp.ts('12', '10:00'), '{}', null) $$),
  'reservation_slot_started', 'CA-03, RN-01: at 10:05, the 10:00 slot can no longer be booked');
select results_eq(
  $$ select started from public.agenda_slots('2030-06-12') where slot_start in (pg_temp.ts('12', '10:00'), pg_temp.ts('12', '11:00')) order by slot_start $$,
  $$ values (true), (false) $$,
  'CA-03: at 10:05 the 10:00 slot has started and the 11:00 one has not');
select pg_temp.at('2030-06-12 08:00');

-- CA-28: a disabled week takes no new reservations; the ones made stay.
select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');
select public.save_agenda_week('2030-06-10', pg_temp.week(), false);
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'),
       pg_temp.ts('13', '09:00'), '{}', null) $$),
  'reservation_week_disabled', 'CA-28: once the week is disabled, it cannot be booked');
select is((select count(*)::int from public.agenda_slots('2030-06-13')), 0,
  'CA-28: a disabled week offers no slots');
select is((select status::text from public.reservations where id = pg_temp.id_of('r_camilo9')), 'pending',
  'CA-28: the reservations already made stay as they were');
select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');
select public.save_agenda_week('2030-06-10', pg_temp.week(), true);

-- CA-31: closing a day or lowering the seats keeps the reservations and flags them.
select public.save_agenda_week('2030-06-10', pg_temp.week(jsonb_build_object(
  '2', jsonb_build_object('is_open', false, 'opens_at', '09:00', 'closes_at', '18:00'))), true);
select results_eq(
  $$ select slot_start, out_of_hours from public.reservation_summaries where id = pg_temp.id_of('r_camilo9') $$,
  $$ values (pg_temp.ts('12', '09:00'), true) $$,
  'CA-31: with Wednesday closed, the 9:00 reservation keeps its time and is flagged out of hours');
select public.save_agenda_week('2030-06-10', pg_temp.week(), true);
select public.save_agenda_settings(60, 1, 15);
select results_eq(
  $$ select id = pg_temp.id_of('r_carla9'), over_capacity from public.reservation_summaries
     where id in (pg_temp.id_of('r_camilo9'), pg_temp.id_of('r_carla9')) order by number $$,
  $$ values (false, false), (true, true) $$,
  'CA-31: with 1 seat, the second reservation at 9:00 is over capacity, the first is not');
select public.save_agenda_settings(60, 2, 15);
select is((select out_of_hours or over_capacity from public.reservation_summaries where id = pg_temp.id_of('r_camilo9')),
  false, 'back to the hours and the seats, nothing is flagged');

-- Moving a reservation (CA-20).
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select pg_temp.remember('r_pablo13', public.save_reservation(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'),
  pg_temp.ts('12', '13:00'), '{}', null));
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'),
       pg_temp.ts('12', '09:00'), '{}', null, pg_temp.id_of('r_pablo13')) $$),
  'reservation_slot_full', 'CA-20: a reservation cannot move to a full slot');
select lives_ok($$ select public.save_reservation(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'),
       pg_temp.ts('12', '14:00'), '{}', 'Cambió de hora', pg_temp.id_of('r_pablo13')) $$,
  'CA-20: a pending reservation moves to a slot with a free seat');
select results_eq(
  $$ select pg_temp.taken('12', '13:00'), pg_temp.taken('12', '14:00'),
            (select updated_by from public.reservations where id = pg_temp.id_of('r_pablo13')) $$,
  $$ values (0, 1, '00000000-0000-0000-0000-0000000012b1'::uuid) $$,
  'CA-20: the old slot gets its seat back, the new one takes it, and it records who changed it');
-- With half-hour slots and 1 seat, moving 14:00–15:00 to 14:30 overlaps only itself: it does not
-- count its own seat.
select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');
select public.save_agenda_settings(30, 1, 15);
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select lives_ok($$ select public.save_reservation(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'),
       pg_temp.ts('12', '14:30'), '{}', null, pg_temp.id_of('r_pablo13')) $$,
  'CA-20: a reservation moving within its own time does not take its own seat');
select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');
select public.save_agenda_settings(60, 2, 15);
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');

-- Own tolerance (CA-24, CA-25).
select is(pg_temp.error_hint($$ select public.set_reservation_tolerance(pg_temp.id_of('r_wendy10'), 30) $$),
  'reservation_admin_only', 'CA-25: an operator cannot change a reservation''s tolerance');
select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');
select lives_ok($$ select public.set_reservation_tolerance(pg_temp.id_of('r_wendy10'), 30) $$,
  'CA-24: the admin gives a reservation 30 minutes of tolerance');
select results_eq(
  $$ select effective_tolerance_minutes::int, grace_until from public.reservation_summaries where id = pg_temp.id_of('r_wendy10') $$,
  $$ values (30, pg_temp.ts('12', '10:30')) $$,
  'CA-24: its tolerance is its own: it can arrive until 10:30');
select is(pg_temp.error_hint($$ select public.set_reservation_tolerance(pg_temp.id_of('r_wendy10'), 61) $$),
  'reservation_tolerance_out_of_range', 'RN-11: an own tolerance goes from 0 to 60 minutes');
select public.set_reservation_tolerance(pg_temp.id_of('r_wendy10'), null);
select is((select effective_tolerance_minutes::int from public.reservation_summaries where id = pg_temp.id_of('r_wendy10')),
  15, 'CA-24: back to the general tolerance');
select lives_ok($$ select public.set_reservation_tolerance(pg_temp.id_of('r_carla9'), 45) $$,
  'CA-24: Carla gets 45 minutes, so she keeps 9:00 if she arrives by 9:45');

-- The customer arrives (HU-03) ------------------------------------------------------------------------------
-- CA-15: Pablo arrives at 8:00 without a reservation for this order (his 14:00 one is another
-- visit); at 9:00:30 Lucía arrives without one and is saved first; at 9:05 Camilo arrives for his
-- 9:00 reservation. The queue: Pablo, Camilo, Lucía.
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select pg_temp.remember('r_tomorrow', public.save_reservation(pg_temp.id_of('lucia'), pg_temp.id_of('lucia_moto'),
  pg_temp.ts('13', '09:00'), '{}', null));
select pg_temp.remember('r_lucia11', public.save_reservation(pg_temp.id_of('lucia'), pg_temp.id_of('lucia_moto'),
  pg_temp.ts('12', '11:00'), '{}', null));
select pg_temp.remember('o_pablo', public.save_work_order(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'),
  pg_temp.lines('RS Lavado')));
select pg_temp.at('2030-06-12 09:00:30');
select pg_temp.remember('o_lucia', public.save_work_order(pg_temp.id_of('lucia'), pg_temp.id_of('lucia_moto'),
  pg_temp.lines('RS Lavado')));
select pg_temp.at('2030-06-12 09:05');
select lives_ok(
  $$ select pg_temp.remember('o_camilo', public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.lines('RS Lavado'), p_reservation_id => pg_temp.id_of('r_camilo9'))) $$,
  'CA-13: Camilo arrives at 9:05 and his reservation becomes his order');
select results_eq(
  $$ select status::text, work_order_id, attended_by from public.reservations where id = pg_temp.id_of('r_camilo9') $$,
  $$ values ('attended', pg_temp.id_of('o_camilo'), '00000000-0000-0000-0000-0000000012b1'::uuid) $$,
  'CA-13, RF-04: the reservation is attended and linked to its order');
select results_eq(
  $$ select turn_at, reservation_id, reserved_start from public.work_order_summaries where id = pg_temp.id_of('o_camilo') $$,
  $$ values (pg_temp.ts('12', '09:00'), pg_temp.id_of('r_camilo9'), pg_temp.ts('12', '09:00')) $$,
  'CA-15, CA-16: arriving 5 minutes late, his turn is 9:00, and the order shows its reservation');
select results_eq(
  $$ select array_agg(id order by turn_at, reservation_id is null, opened_at)
     from public.work_order_summaries where status = 'open' $$,
  $$ values (array[pg_temp.id_of('o_pablo'), pg_temp.id_of('o_camilo'), pg_temp.id_of('o_lucia')]) $$,
  'CA-15: the queue is Pablo (8:00), Camilo (reservation 9:00), Lucía (9:00:30), though Lucía was saved first');
select is(
  (select turn_at from public.work_order_summaries where id = pg_temp.id_of('o_pablo')), pg_temp.ts('12', '08:00'),
  'RN-04: without a reservation, the turn is the arrival');
select is(pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.lines('RS Lavado'), p_reservation_id => pg_temp.id_of('r_camilo9')) $$),
  'reservation_not_pending', 'CA-19: an attended reservation does not arrive twice');
select is(pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('lucia'), pg_temp.id_of('lucia_moto'),
       pg_temp.lines('RS Lavado'), p_reservation_id => pg_temp.id_of('r_tomorrow')) $$),
  'reservation_not_today', 'CA-19: tomorrow''s reservation cannot arrive today');
select is(pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('wendy'), pg_temp.id_of('pablo_moto'),
       pg_temp.lines('RS Lavado'), p_reservation_id => pg_temp.id_of('r_carla9')) $$),
  'reservation_customer_mismatch', 'CA-19: a reservation arrives only with its own customer');

-- Carla, with her own 45 minutes, arrives at 9:40: she keeps 9:00 (CA-24).
select pg_temp.at('2030-06-12 09:40');
select pg_temp.remember('o_carla', public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
  pg_temp.lines('RS Lavado'), p_reservation_id => pg_temp.id_of('r_carla9')));
select is((select turn_at from public.work_order_summaries where id = pg_temp.id_of('o_carla')), pg_temp.ts('12', '09:00'),
  'CA-24: 40 minutes late, within her own 45, Carla keeps 9:00');

-- The vehicle already had its order open: the reservation links to it (assumption of the spec).
select pg_temp.remember('r_pablo12', public.save_reservation(pg_temp.id_of('pablo'), null,
  pg_temp.ts('12', '12:00'), '{}', null));
select lives_ok(
  $$ select public.save_work_order(pg_temp.id_of('pablo'), pg_temp.id_of('pablo_moto'), pg_temp.lines('RS Lavado'),
       p_id => pg_temp.id_of('o_pablo'), p_reservation_id => pg_temp.id_of('r_pablo12')) $$,
  'a reservation links to the order its vehicle already has open');
select results_eq(
  $$ select r.work_order_id, o.turn_at from public.reservations r join public.work_order_summaries o on o.id = r.work_order_id
     where r.id = pg_temp.id_of('r_pablo12') $$,
  $$ values (pg_temp.id_of('o_pablo'), pg_temp.ts('12', '08:00')) $$,
  'that order keeps its 8:00 turn (it arrived before the reservation)');
select public.start_work_order(pg_temp.id_of('o_lucia'));
select is(pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('lucia'), pg_temp.id_of('lucia_moto'),
       pg_temp.lines('RS Lavado'), p_id => pg_temp.id_of('o_lucia'), p_reservation_id => pg_temp.id_of('r_lucia11')) $$),
  'reservation_order_started', 'an order already started does not take a reservation');

-- Cancel, no-show, and nothing after (HU-04) -----------------------------------------------------------------
select lives_ok($$ select public.cancel_reservation(pg_temp.id_of('r_wendy10'), ' Se le dañó la moto ') $$,
  'CA-21: staff cancel a reservation with a reason');
select results_eq(
  $$ select status::text, cancel_reason, cancelled_by from public.reservations where id = pg_temp.id_of('r_wendy10') $$,
  $$ values ('cancelled', 'Se le dañó la moto', '00000000-0000-0000-0000-0000000012b1'::uuid) $$,
  'CA-21: it is cancelled, with why and by whom');
select is(pg_temp.taken('12', '10:00'), 0, 'CA-21: a cancelled reservation frees its seat');
select is(pg_temp.error_hint($$ select public.mark_reservation_no_show(pg_temp.id_of('r_camilo11')) $$),
  'reservation_no_show_too_early', 'CA-22: at 9:40, the 11:00 reservation cannot be a no-show yet');
select pg_temp.at('2030-06-12 11:15');
select is(pg_temp.error_hint($$ select public.mark_reservation_no_show(pg_temp.id_of('r_camilo11')) $$),
  'reservation_no_show_too_early', 'CA-22: at 11:15 it is still within its 15 minutes');
select pg_temp.at('2030-06-12 11:16');
select lives_ok($$ select public.mark_reservation_no_show(pg_temp.id_of('r_camilo11')) $$,
  'CA-22: at 11:16, past its tolerance, it is marked as a no-show');
select results_eq(
  $$ select status::text, no_show_by from public.reservations where id = pg_temp.id_of('r_camilo11') $$,
  $$ values ('no_show', '00000000-0000-0000-0000-0000000012b1'::uuid) $$,
  'CA-22: the no-show records who marked it');
select is(pg_temp.taken('12', '11:00'), 1, 'a no-show frees its seat (only Lucía remains at 11:00)');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('12', '15:00'), '{}', null, pg_temp.id_of('r_camilo11')) $$),
  'reservation_not_pending', 'CA-23: a no-show cannot be changed');
select is(pg_temp.error_hint($$ select public.cancel_reservation(pg_temp.id_of('r_camilo9')) $$),
  'reservation_not_pending', 'CA-23: an attended reservation cannot be cancelled');
select is(pg_temp.error_hint($$ select public.cancel_reservation(pg_temp.id_of('r_wendy10')) $$),
  'reservation_not_pending', 'CA-23: a cancelled reservation cannot be cancelled again');
select is(pg_temp.error_hint($$ select public.mark_reservation_no_show(pg_temp.id_of('r_camilo9')) $$),
  'reservation_not_pending', 'CA-23: an attended reservation is not a no-show');
select pg_temp.act_as('00000000-0000-0000-0000-0000000012a1');
select is(pg_temp.error_hint($$ select public.set_reservation_tolerance(pg_temp.id_of('r_camilo9'), 30) $$),
  'reservation_not_pending', 'RN-11: the tolerance only changes while pending');
select throws_ok($$ delete from public.reservations where id = pg_temp.id_of('r_wendy10') $$, '42501', null,
  'CA-23, RN-05: not even an admin deletes a reservation');
select throws_ok($$ update public.reservations set status = 'pending' where id = pg_temp.id_of('r_wendy10') $$, '42501', null,
  'RN-05: not even an admin writes a reservation directly');

-- Who reads and who writes (RN-06) -----------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000012b1');
select isnt_empty($$ select 1 from public.reservation_summaries $$, 'staff read the agenda');
select pg_temp.act_as('00000000-0000-0000-0000-0000000012c1');
select is_empty($$ select 1 from public.reservations $$, 'RN-06: a customer reads no reservation (not even their own)');
select is_empty($$ select 1 from public.agenda_days $$, 'RN-06: a customer does not read the agenda');
select is_empty($$ select 1 from public.agenda_slots('2030-06-12') $$, 'RN-06: a customer sees no slots');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('12', '16:00'), '{}', null) $$),
  'reservation_staff_only', 'RN-06: a customer cannot book');
select is(pg_temp.error_hint($$ select public.cancel_reservation(pg_temp.id_of('r_pablo13')) $$),
  'reservation_staff_only', 'RN-06: a customer cannot cancel');

reset role;
select * from finish();
rollback;
