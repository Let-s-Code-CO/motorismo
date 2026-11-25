-- customer_area — what a customer with an account sees and does (spec 014).
--
-- * my_shop_orders: their open orders, each with how many orders go before it in the queue (the
--   queue's rule, spec 012 RN-04: by turn, a reservation first on a tie, then by arrival), its
--   services and times; never anything of another customer (CA-01 to CA-06).
-- * my_order_history: their closed orders, newest first, never the voided ones, with lines, discount,
--   total and payments; also of retired vehicles; paged by date (CA-07 to CA-11).
-- * my_reservations and bookable_day: their reservations and the slots of a day, with no data of
--   anyone else (CA-12, CA-13, CA-17, CA-22).
-- * save_reservation / cancel_reservation for a customer: only their own, with the agenda's rules
--   (spec 012), one pending reservation per vehicle and one without vehicle a day (RN-03, as amended
--   by spec 021; 18_customer_reservations_per_day covers the days), never the
--   tolerance (RN-05); recorded as made, changed or cancelled by the customer (CA-14 to CA-21).
-- * The tables and the staff views stay closed to customers (RN-01).
--
-- The clock is fixed through private.agenda_now(), as in 11_reservations: Wednesday 12 June 2030.
begin;
create extension if not exists pgtap with schema extensions;

select plan(54);

create or replace function private.agenda_now()
returns timestamptz language sql stable set search_path = '' as $$
  select current_setting('test.now')::timestamptz;
$$;
create function pg_temp.at(p_local text)
returns void language sql as $$ select set_config('test.now', p_local || '-05', true); $$;
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

-- Independent of the seeds.
delete from public.reservation_extensions;
delete from public.reservation_services;
delete from public.reservations;
delete from public.agenda_days;
delete from public.agenda_weeks;
delete from public.work_order_payments;
delete from public.work_order_line_employees;
delete from public.work_order_lines;
delete from public.work_orders;

-- People ---------------------------------------------------------------------------------------------
select pg_temp.new_staff('00000000-0000-0000-0000-0000000014a1', 'ca-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000014c1', 'ca-camilo@test.local', 'Camilo Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000014c2', 'ca-carla@test.local', 'Carla Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000014c3', 'ca-dario@test.local', 'Darío Desactivado');
select pg_temp.remember(split_part(split_part(email, '@', 1), '-', 2), id)
  from public.customers where email like 'ca-%@test.local';

insert into public.services (name, price_motorcycle, price_car, estimated_minutes) values
  ('CA Lavado', 25000, 40000, 30), ('CA Cadena', 15000, null, null), ('CA Viejo', 10000, 10000, 15);
update public.services set disabled_at = now() where name = 'CA Viejo';
select pg_temp.remember(name, id) from public.services where name like 'CA %';

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a1');
select pg_temp.remember('camilo_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'CAA12B'));
select pg_temp.remember('camilo_car', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'car', p_vehicle_class => 'utility', p_brand_name => 'Mazda',
  p_line_name => 'CX-30', p_color => 'gray', p_plate => 'CAB123', p_plate_city_code => '11001'));
select pg_temp.remember('camilo_old', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha',
  p_line_name => 'BWS FI', p_color => 'blue', p_plate => 'CAC12D'));
select pg_temp.remember('carla_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'AKT',
  p_line_name => 'NKD 125', p_color => 'red', p_plate => 'CAD12E'));
select pg_temp.remember('carla_car', public.save_vehicle(
  p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'utility', p_brand_name => 'Kia',
  p_line_name => 'Picanto', p_color => 'white', p_plate => 'CAE123', p_plate_city_code => '11001'));
-- The week of 10 June 2030 enabled, Sunday 16 closed.
select public.save_agenda_week('2030-06-10', (
  select jsonb_agg(case when i = 6 then jsonb_build_object('is_open', false, 'opens_at', '09:00', 'closes_at', '18:00')
                        else jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '18:00') end order by i)
  from generate_series(0, 6) as i), true);
reset role;
update public.vehicles set retired_at = now() where id = pg_temp.id_of('camilo_old');
update public.customers set disabled_at = now() where id = pg_temp.id_of('dario');

-- Orders, written directly (setup) -------------------------------------------------------------------
-- The queue at 8:45: Carla's motorcycle (turn 8:00), Carla's car (turn 8:30, with a reservation) and
-- Camilo's motorcycle (turn 8:30, no reservation: after the reserved one). Camilo's car in progress.
create function pg_temp.order(p_name text, p_vehicle text, p_opened text, p_turn text)
returns uuid language sql as $$
  with o as (
    insert into public.work_orders (customer_id, vehicle_id, opened_at, opened_by, turn_at)
    select v.customer_id, v.id, pg_temp.ts('12', p_opened), '00000000-0000-0000-0000-0000000014a1', pg_temp.ts('12', p_turn)
    from public.vehicles v where v.id = pg_temp.id_of(p_vehicle)
    returning id)
  select pg_temp.remember(p_name, id) from o;
$$;
create function pg_temp.line(p_order text, p_position int, p_service text, p_price int, p_minutes int)
returns void language sql as $$
  insert into public.work_order_lines (work_order_id, position, service_id, name, price, estimated_minutes)
  values (pg_temp.id_of(p_order), p_position, pg_temp.id_of(p_service), p_service, p_price, p_minutes);
$$;
select pg_temp.order('o_carla_moto', 'carla_moto', '08:00', '08:00');
select pg_temp.order('o_carla_car', 'carla_car', '08:40', '08:30');
select pg_temp.order('o_camilo_moto', 'camilo_moto', '08:30', '08:30');
select pg_temp.order('o_camilo_car', 'camilo_car', '07:50', '07:50');
update public.work_orders set started_at = pg_temp.ts('12', '09:00'), started_by = '00000000-0000-0000-0000-0000000014a1'
 where id = pg_temp.id_of('o_camilo_car');
insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, created_by, status, attended_at, attended_by, work_order_id)
values (pg_temp.id_of('carla'), pg_temp.id_of('carla_car'), pg_temp.ts('12', '08:30'), pg_temp.ts('12', '09:30'),
        '00000000-0000-0000-0000-0000000014a1', 'attended', pg_temp.ts('12', '08:40'), '00000000-0000-0000-0000-0000000014a1',
        pg_temp.id_of('o_carla_car'));
select pg_temp.line('o_camilo_car', 1, 'CA Lavado', 40000, 30);
select pg_temp.line('o_camilo_car', 2, 'CA Cadena', 15000, null);

-- History: Camilo's retired motorcycle on 1 June, his motorcycle on 5 June (corrected, with discount
-- and two payments), a voided order on 8 June; one of Carla's.
create function pg_temp.closed(p_name text, p_vehicle text, p_day text)
returns uuid language sql as $$
  with o as (
    insert into public.work_orders (customer_id, vehicle_id, opened_at, opened_by, started_at, started_by,
                                    closed_at, closed_by, status)
    select v.customer_id, v.id, pg_temp.ts(p_day, '09:00'), '00000000-0000-0000-0000-0000000014a1',
           pg_temp.ts(p_day, '09:10'), '00000000-0000-0000-0000-0000000014a1',
           pg_temp.ts(p_day, '10:00'), '00000000-0000-0000-0000-0000000014a1', 'closed'
    from public.vehicles v where v.id = pg_temp.id_of(p_vehicle)
    returning id)
  select pg_temp.remember(p_name, id) from o;
$$;
select pg_temp.closed('h_old', 'camilo_old', '01');
select pg_temp.line('h_old', 1, 'CA Lavado', 25000, 30);
insert into public.work_order_payments (work_order_id, method, amount) values (pg_temp.id_of('h_old'), 'cash', 25000);
select pg_temp.closed('h_moto', 'camilo_moto', '05');
select pg_temp.line('h_moto', 1, 'CA Lavado', 25000, 30);
select pg_temp.line('h_moto', 2, 'CA Cadena', 15000, null);
update public.work_orders set discount = 5000, corrected_at = pg_temp.ts('05', '11:00'),
       corrected_by = '00000000-0000-0000-0000-0000000014a1', correction_reason = 'Descuento acordado'
 where id = pg_temp.id_of('h_moto');
insert into public.work_order_payments (work_order_id, method, amount) values
  (pg_temp.id_of('h_moto'), 'card', 15000), (pg_temp.id_of('h_moto'), 'cash', 20000);
select pg_temp.closed('h_void', 'camilo_moto', '08');
update public.work_orders set status = 'voided', voided_at = pg_temp.ts('08', '11:00'),
       voided_by = '00000000-0000-0000-0000-0000000014a1', void_reason = 'Error'
 where id = pg_temp.id_of('h_void');
select pg_temp.closed('h_carla', 'carla_moto', '06');

-- Shape -------------------------------------------------------------------------------------------------
select has_column('public', 'reservations', 'booked_by_customer', 'CA-16: a reservation says if the customer booked it');
select has_column('public', 'reservations', 'updated_by_customer', 'a reservation says if the customer changed it');
select has_column('public', 'reservations', 'cancelled_by_customer', 'CA-19: a reservation says if the customer cancelled it');
select col_is_null('public', 'reservations', 'created_by', 'a reservation booked by the customer has no staff author');
select throws_ok($$ insert into public.reservations (customer_id, slot_start, slot_end)
                    values (pg_temp.id_of('camilo'), pg_temp.ts('13', '09:00'), pg_temp.ts('13', '10:00')) $$,
  '23514', null, 'a reservation always says who made it: staff or the customer');
select has_column('public', 'reservation_summaries', 'booked_by_customer', 'CA-16: staff see who booked it');

-- Their vehicle in the shop (HU-01) ---------------------------------------------------------------------
select pg_temp.at('2030-06-12 09:05');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');

select results_eq(
  $$ select id, ahead from public.my_shop_orders() order by opened_at $$,
  $$ values (pg_temp.id_of('o_camilo_car'), null::int), (pg_temp.id_of('o_camilo_moto'), 2) $$,
  'CA-01, CA-03: each of their vehicles; in the queue, 2 before (8:00, and 8:30 with a reservation before 8:30 without)');
select is(
  (select lines from public.my_shop_orders() where id = pg_temp.id_of('o_camilo_car')),
  '[{"name": "CA Lavado", "estimated_minutes": 30}, {"name": "CA Cadena", "estimated_minutes": null}]'::jsonb,
  'CA-02: the services of the order in progress, with their times');
select results_eq(
  $$ select vehicle_type, brand_name, line_name, plate, started_at from public.my_shop_orders()
     where id = pg_temp.id_of('o_camilo_car') $$,
  $$ values ('car'::text, 'Mazda'::text, 'CX-30'::text, 'CAB123'::text, pg_temp.ts('12', '09:00')) $$,
  'CA-02: which vehicle and since when it is in progress');
select ok(
  pg_get_function_result('public.my_shop_orders()'::regprocedure) !~ '(customer|_by|employee|notes)',
  'CA-06: nothing about who opened or worked it, nor of another customer');

select pg_temp.act_as('00000000-0000-0000-0000-0000000014c2');
select results_eq(
  $$ select id, ahead from public.my_shop_orders() order by opened_at $$,
  $$ values (pg_temp.id_of('o_carla_moto'), 0), (pg_temp.id_of('o_carla_car'), 1) $$,
  'CA-06: another customer sees only their own orders');
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a1');
select is_empty($$ select 1 from public.my_shop_orders() $$, 'staff are no customer: nothing of their own');
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c3');
select is_empty($$ select 1 from public.my_shop_orders() $$, 'a disabled customer sees nothing');

-- Their history (HU-02) ------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select results_eq(
  $$ select id from public.my_order_history() $$,
  $$ values (pg_temp.id_of('h_moto')), (pg_temp.id_of('h_old')) $$,
  'CA-07, CA-08, CA-09: newest first, without the voided one, with the retired vehicle''s');
select results_eq(
  $$ select subtotal, discount, total, lines, payments from public.my_order_history()
     where id = pg_temp.id_of('h_moto') $$,
  $$ values (40000, 5000, 35000,
             '[{"name": "CA Lavado", "price": 25000}, {"name": "CA Cadena", "price": 15000}]'::jsonb,
             '[{"method": "cash", "amount": 20000}, {"method": "card", "amount": 15000}]'::jsonb) $$,
  'CA-07, CA-08: the corrected order with its lines, discount (25 000 + 15 000 − 5 000 = 35 000) and payments');
select results_eq(
  $$ select id from public.my_order_history(p_before => pg_temp.ts('05', '10:00')) $$,
  $$ values (pg_temp.id_of('h_old')) $$,
  'CA-11: the older ones, before a date');
select results_eq(
  $$ select id from public.my_order_history(p_limit => 1) $$,
  $$ values (pg_temp.id_of('h_moto')) $$,
  'CA-11: a page at a time');
select ok(
  pg_get_function_result('public.my_order_history(timestamptz, integer)'::regprocedure) !~ '(customer|_by|employee|reason)',
  'CA-06: no names of staff or employees, nor the reasons of a correction');

-- The day to book (CA-12, CA-13) ------------------------------------------------------------------------
select pg_temp.at('2030-06-12 08:00');
select is(public.bookable_day('2030-06-13') ->> 'state', 'open', 'CA-12: an open day of an enabled week');
select is(jsonb_array_length(public.bookable_day('2030-06-13') -> 'slots'), 9,
  'CA-12: its slots, 9:00 to 6:00 p. m. in one-hour slots (9)');
select is(public.bookable_day('2030-06-13') -> 'slots' -> 0,
  jsonb_build_object('slot_start', pg_temp.ts('13', '09:00'), 'slot_end', pg_temp.ts('13', '10:00'),
                     'seats', 2, 'taken', 0, 'started', false),
  'CA-12: each slot with its seats and how many are taken');
select is(public.bookable_day('2030-06-16') ->> 'state', 'closed', 'CA-13: a closed day');
select is(public.bookable_day('2030-06-20') ->> 'state', 'unenabled', 'CA-13: a week not enabled');

-- Booking, changing, cancelling (HU-03, HU-04) ---------------------------------------------------------
select pg_temp.remember('r_moto', public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
  pg_temp.ts('13', '10:00'), array[pg_temp.id_of('CA Lavado')], 'Llego en la mañana'));
reset role;
select results_eq(
  $$ select booked_by_customer, created_by, tolerance_minutes from public.reservations where id = pg_temp.id_of('r_moto') $$,
  $$ values (true, null::uuid, null::smallint) $$,
  'CA-12, CA-16: the customer booked it, with the general tolerance');
select is((public.bookable_day('2030-06-13') -> 'slots' -> 1 ->> 'taken')::int, 1,
  'CA-16: it takes its seat like any other: 10:00 has 1 of 2 taken');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('13', '11:00'), '{}', null) $$),
  'reservation_customer_limit', 'CA-15, RN-03 (spec 021, RN-01): one pending reservation per vehicle a day from the app');
select pg_temp.remember('r_none', public.save_reservation(pg_temp.id_of('camilo'), null,
  pg_temp.ts('13', '09:00'), '{}', null));
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), null,
       pg_temp.ts('13', '15:00'), '{}', null) $$),
  'reservation_customer_limit', 'CA-15, RN-03 (spec 021, RN-01): and one without vehicle a day');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('carla'), pg_temp.id_of('carla_moto'),
       pg_temp.ts('13', '11:00'), '{}', null) $$),
  'reservation_customer_only', 'CA-21: never for another customer');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('carla_moto'),
       pg_temp.ts('13', '11:00'), '{}', null) $$),
  'reservation_vehicle_invalid', 'never with someone else''s vehicle');

-- 12:00 full (2 seats) with two reservations made by staff for Carla.
select pg_temp.act_as('00000000-0000-0000-0000-0000000014a1');
select pg_temp.remember('r_carla_moto', public.save_reservation(pg_temp.id_of('carla'), pg_temp.id_of('carla_moto'),
  pg_temp.ts('13', '12:00'), '{}', null));
select public.save_reservation(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'), pg_temp.ts('13', '12:00'), '{}', null);
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_car'),
       pg_temp.ts('13', '12:00'), '{}', null) $$),
  'reservation_slot_full', 'CA-14: the agenda''s rules: a full slot');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_car'),
       pg_temp.ts('12', '07:00'), '{}', null) $$),
  'reservation_slot_invalid', 'CA-12: only a slot of the day''s hours');

select lives_ok($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('13', '14:00'), array[pg_temp.id_of('CA Lavado'), pg_temp.id_of('CA Cadena')], null,
       pg_temp.id_of('r_moto')) $$,
  'CA-18: they change their own pending reservation');
reset role;
select results_eq(
  $$ select slot_start, updated_by_customer, updated_by, tolerance_minutes from public.reservations
     where id = pg_temp.id_of('r_moto') $$,
  $$ values (pg_temp.ts('13', '14:00'), true, null::uuid, null::smallint) $$,
  'CA-18, RN-05: changed by the customer, without touching the tolerance');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('carla'), pg_temp.id_of('carla_moto'),
       pg_temp.ts('13', '15:00'), '{}', null, pg_temp.id_of('r_carla_moto')) $$),
  'reservation_customer_only', 'CA-21: never changes someone else''s');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       pg_temp.ts('13', '15:00'), '{}', null, pg_temp.id_of('r_carla_moto')) $$),
  'reservation_customer_only', 'CA-21: not even claiming it as theirs');
select is(pg_temp.error_hint($$ select public.set_reservation_tolerance(pg_temp.id_of('r_moto'), 30::smallint) $$),
  'reservation_admin_only', 'RN-05: the tolerance stays the staff''s');

-- Their reservations (CA-17, CA-22): pending first, nearest first; the past ones of the last days after.
reset role;
insert into public.reservations (customer_id, slot_start, slot_end, created_by, status, cancelled_at, cancelled_by)
values (pg_temp.id_of('camilo'), pg_temp.ts('05', '10:00'), pg_temp.ts('05', '11:00'), '00000000-0000-0000-0000-0000000014a1',
        'cancelled', pg_temp.ts('04', '10:00'), '00000000-0000-0000-0000-0000000014a1'),
       (pg_temp.id_of('camilo'), '2030-04-01 10:00-05', '2030-04-01 11:00-05', '00000000-0000-0000-0000-0000000014a1',
        'cancelled', '2030-03-30 10:00-05', '00000000-0000-0000-0000-0000000014a1');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select results_eq(
  $$ select slot_start, status::text from public.my_reservations('2030-05-13') $$,
  $$ values (pg_temp.ts('13', '09:00'), 'pending'), (pg_temp.ts('13', '14:00'), 'pending'),
            (pg_temp.ts('05', '10:00'), 'cancelled') $$,
  'CA-17: pending first, nearest first; then the recent past ones (not the ones of April)');
select results_eq(
  $$ select grace_until, services, plate, booked_by_customer from public.my_reservations('2030-05-13')
     where id = pg_temp.id_of('r_moto') $$,
  $$ values (pg_temp.ts('13', '14:15'), array['CA Lavado', 'CA Cadena'], 'CAA12B'::text, true) $$,
  'CA-17: until when to arrive (14:00 + 15 min), the services and the vehicle');
reset role;
update public.reservations set tolerance_minutes = 25 where id = pg_temp.id_of('r_moto');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select is((select grace_until from public.my_reservations('2030-05-13') where id = pg_temp.id_of('r_moto')),
  pg_temp.ts('13', '14:25'), 'CA-22: more time given by staff is what they read next (14:00 + 25 min)');
select ok(
  pg_get_function_result('public.my_reservations(date)'::regprocedure) !~ '(customer_id|_by |_by_name|employee)',
  'CA-06: no names of staff');
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c2');
select is_empty($$ select 1 from public.my_reservations('2030-05-13') where id = pg_temp.id_of('r_moto') $$,
  'CA-21: another customer does not see them');

select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select lives_ok($$ select public.cancel_reservation(pg_temp.id_of('r_none')) $$,
  'CA-19: they cancel their own pending reservation, with no reason');
reset role;
select results_eq(
  $$ select status::text, cancelled_by_customer, cancelled_by, cancel_reason from public.reservations
     where id = pg_temp.id_of('r_none') $$,
  $$ values ('cancelled', true, null::uuid, null::text) $$,
  'CA-19: cancelled by the customer');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select lives_ok($$ select public.cancel_reservation(pg_temp.id_of('r_moto'), 'Me salió un viaje') $$,
  'CA-19: or with a reason');
select is(pg_temp.error_hint($$ select public.cancel_reservation(pg_temp.id_of('r_none')) $$),
  'reservation_not_pending', 'CA-20: only while pending');
select is(pg_temp.error_hint($$ select public.cancel_reservation(pg_temp.id_of('r_carla_moto')) $$),
  'reservation_customer_only', 'CA-21: never someone else''s');
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c3');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('dario'), null,
       pg_temp.ts('13', '16:00'), '{}', null) $$),
  'reservation_customer_only', 'a disabled customer cannot book');

-- What stays closed (RN-01) and what opens -------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000014c1');
select is_empty($$ select 1 from public.work_orders $$, 'RN-01: a customer reads no order directly');
select is_empty($$ select 1 from public.work_order_summaries $$, 'RN-01: nor the staff''s summaries');
select is_empty($$ select 1 from public.reservations $$, 'RN-01: nor the reservations table');
select results_eq(
  $$ select name, motorcycle, car from public.bookable_services() where name like 'CA %' $$,
  $$ values ('CA Cadena'::text, true, false), ('CA Lavado'::text, true, true) $$,
  'CA-12: the active services and for which vehicles, to choose them (not the disabled one)');
select is_empty($$ select 1 from public.services $$, 'spec 007: the catalog itself stays closed to customers');
reset role;

select function_privs_are('public', 'my_shop_orders', array[]::text[], 'anon', array[]::text[],
  'anon cannot read orders of anyone');
select function_privs_are('public', 'my_reservations', array['date'], 'anon', array[]::text[],
  'anon cannot read reservations of anyone');

select * from finish();
rollback;
