-- work_orders — what is done to a vehicle in one visit to the car wash (spec 008).
--
-- An order belongs to a customer and one of their vehicles; it has service lines (from the
-- catalog, or "Otro"), each with a price, an optional estimated time and the employees who did it
-- with their share; it is opened when the vehicle arrives and closed when it is handed over and
-- paid. Every change goes through four functions that apply the rules in one place:
--   * save_work_order: opens (CA-07) or edits an open order (CA-08); refuses a disabled customer, a
--     retired vehicle, another customer's vehicle or a vehicle that already has an open order
--     (CA-10); copies the service's name, reference price and time (CA-03, CA-27, RN-01); "Otro"
--     needs a description (CA-05); shares add up to 100 (CA-06, RN-03); the discount goes from 0 to
--     the subtotal (CA-25); a line of a service disabled later is kept (RN-04);
--   * close_work_order: every line has employees (CA-12); payments add up to the total (CA-11), and
--     a total of 0 needs none (CA-13); a closed order can no longer be edited (CA-14);
--   * correct_work_order: only an admin, with a reason (CA-22);
--   * void_work_order: staff void an open order, only an admin a closed one, always with a reason;
--     a voided order never changes again (CA-21, CA-23).
-- Nobody writes the tables directly, and nobody deletes (CA-14, CA-24). A customer and anon read
-- nothing. The summary view adds up subtotal, total and estimate, and names what is not estimated
-- (CA-29, CA-30). Changing a service's time does not change existing lines (CA-31).
-- Amendment (HU-07): start_work_order moves an open order from the queue to «En proceso» once and
-- for good (CA-33, CA-36); closing does not need it (CA-35).
begin;
create extension if not exists pgtap with schema extensions;

select plan(64);

-- Fixtures -------------------------------------------------------------------------------------
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
-- The id of the n-th line of an order (1-based position).
create function pg_temp.line_of(p_order text, p_position int)
returns uuid language sql stable as $$
  select id from public.work_order_lines where work_order_id = pg_temp.id_of(p_order) and position = p_position;
$$;
create function pg_temp.share(p_employee text, p_pct int)
returns jsonb language sql stable as $$
  select jsonb_build_object('employee_id', pg_temp.id_of(p_employee), 'share_pct', p_pct);
$$;

-- Independent of the seeds: no orders to start with (undone by the final rollback).
-- Reservations (spec 012) point at services and orders: they go first.
delete from public.reservation_extensions;
delete from public.reservation_services;
delete from public.reservations;
delete from public.work_order_payments;
delete from public.work_order_line_employees;
delete from public.work_order_lines;
delete from public.work_orders;

select pg_temp.new_staff('00000000-0000-0000-0000-00000000a8a1', 'wo-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-00000000a8b1', 'wo-op@test.local', 'Oscar Operador', 'operator');
select pg_temp.new_customer('00000000-0000-0000-0000-00000000a8c1', 'wo-camilo@test.local', 'Camilo Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-00000000a8c2', 'wo-carla@test.local', 'Carla Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-00000000a8c3', 'wo-dario@test.local', 'Darío Desactivado');

select pg_temp.remember('camilo', (select id from public.customers where email = 'wo-camilo@test.local'));
select pg_temp.remember('carla', (select id from public.customers where email = 'wo-carla@test.local'));
select pg_temp.remember('dario', (select id from public.customers where email = 'wo-dario@test.local'));

insert into public.services (name, price_motorcycle, price_car, estimated_minutes) values
  ('WO Lavado', 25000, 40000, 30), ('WO Cadena', 15000, null, null), ('WO Viejo', 10000, 10000, 15);
update public.services set disabled_at = now() where name = 'WO Viejo';
select pg_temp.remember(name, id) from public.services where name like 'WO %';

insert into public.employees (full_name) values ('WO Elena'), ('WO Pedro'), ('WO Inactivo');
update public.employees set disabled_at = now() where full_name = 'WO Inactivo';
select pg_temp.remember(full_name, id) from public.employees where full_name like 'WO %';

-- Vehicles, registered by staff as the app does.
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000a8b1');
select pg_temp.remember('camilo_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'WOA12B'));
select pg_temp.remember('camilo_old', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha',
  p_line_name => 'BWS FI', p_color => 'blue', p_plate => 'WOB12C'));
select pg_temp.remember('carla_car', public.save_vehicle(
  p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'utility', p_brand_name => 'Mazda',
  p_line_name => 'CX-30', p_color => 'gray', p_plate => 'WOC123', p_plate_city_code => '11001'));
select pg_temp.remember('dario_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('dario'), p_vehicle_type => 'motorcycle', p_brand_name => 'AKT',
  p_line_name => 'NKD 125', p_color => 'red', p_plate => 'WOD12E'));
reset role;
update public.vehicles set retired_at = now() where id = pg_temp.id_of('camilo_old');
update public.customers set disabled_at = now() where id = pg_temp.id_of('dario');

-- Shape and access ---------------------------------------------------------------------------------
select has_table('public', 'work_orders', 'the work orders table exists');
select has_table('public', 'work_order_lines', 'the order lines table exists');
select has_table('public', 'work_order_line_employees', 'the line employees table exists');
select has_table('public', 'work_order_payments', 'the payments table exists');
select has_view('public', 'work_order_summaries', 'the summaries view exists');
select enum_has_labels('public', 'work_order_status', array['open', 'closed', 'voided'],
  'RF-03: an order is open, closed or voided');
select enum_has_labels('public', 'payment_method', array['cash', 'transfer', 'card', 'other'],
  'RN-09: cash, transfer, card or other');
select throws_ok(
  $$ update public.services set estimated_minutes = 4 where name = 'WO Lavado' $$,
  '23514', null, 'CA-26, RN-11: a service time is at least 5 minutes');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in (
    'public.work_orders'::regclass, 'public.work_order_lines'::regclass,
    'public.work_order_line_employees'::regclass, 'public.work_order_payments'::regclass)),
  'RLS is enabled on the four tables'
);
select ok(
  not exists (
    select 1 from unnest(array['work_orders', 'work_order_lines', 'work_order_line_employees',
                               'work_order_payments']) t(name),
                  unnest(array['INSERT', 'UPDATE', 'DELETE']) p(privilege)
    where has_table_privilege('authenticated', 'public.' || t.name, p.privilege)),
  'CA-14, CA-24: nobody writes or deletes the tables directly, only through the functions'
);
select ok(
  not has_table_privilege('anon', 'public.work_orders', 'SELECT')
  and not has_table_privilege('anon', 'public.work_order_summaries', 'SELECT'),
  'anon reads nothing'
);

-- Opening (as an operator) -------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000a8b1');

select lives_ok(
  $$ select pg_temp.remember('o1', public.save_work_order(
       p_customer_id => pg_temp.id_of('camilo'), p_vehicle_id => pg_temp.id_of('camilo_moto'),
       p_lines => jsonb_build_array(
         jsonb_build_object('service_id', pg_temp.id_of('WO Lavado')),
         jsonb_build_object('service_id', pg_temp.id_of('WO Cadena'), 'price', 12000,
           'employees', jsonb_build_array(pg_temp.share('WO Elena', 50), pg_temp.share('WO Pedro', 50)))))) $$,
  'CA-07: staff open an order with two services');
select results_eq(
  $$ select status::text, opened_by, number > 0 from public.work_orders where id = pg_temp.id_of('o1') $$,
  $$ values ('open', '00000000-0000-0000-0000-00000000a8b1'::uuid, true) $$,
  'CA-07: the order is open, numbered, and records who opened it');
select results_eq(
  $$ select name, price, estimated_minutes::int from public.work_order_lines
     where work_order_id = pg_temp.id_of('o1') order by position $$,
  $$ values ('WO Lavado', 25000, 30), ('WO Cadena', 12000, null) $$,
  'CA-03, CA-27, RN-01: a line copies the name, the reference price for the type and the time; a typed price wins');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Lavado')))) $$),
  'work_order_vehicle_busy',
  'a vehicle with an open order cannot get another one');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('dario'), pg_temp.id_of('dario_moto'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Lavado')))) $$),
  'work_order_customer_disabled',
  'CA-10, RN-08: no order for a disabled customer');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_old'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Lavado')))) $$),
  'work_order_vehicle_retired',
  'CA-10, RN-08: no order for a retired vehicle');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('carla_car'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Lavado')))) $$),
  'work_order_vehicle_invalid',
  'RF-01: the vehicle must be the customer''s');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Viejo')))) $$),
  'work_order_service_unavailable',
  'CA-03, RN-04: a disabled service is not offered');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Cadena')))) $$),
  'work_order_service_unavailable',
  'CA-03: a service without a price for the vehicle type is not offered for it');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
     jsonb_build_array(jsonb_build_object('name', '  ', 'price', 1000))) $$),
  'work_order_other_name_required',
  'CA-05: «Otro» needs a description');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Lavado'),
       'employees', jsonb_build_array(pg_temp.share('WO Elena', 60), pg_temp.share('WO Pedro', 30))))) $$),
  'work_order_shares_invalid',
  'CA-06, RN-03: the shares of a line add up to 100');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Lavado'),
       'employees', jsonb_build_array(pg_temp.share('WO Inactivo', 100))))) $$),
  'work_order_employee_unavailable',
  'RN-04: a disabled employee is not offered');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
     jsonb_build_array(jsonb_build_object('service_id', pg_temp.id_of('WO Lavado'))), p_discount => 40001) $$),
  'work_order_discount_invalid',
  'CA-25: the discount is at most the subtotal ($ 40.000)');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'), '[]'::jsonb) $$),
  'work_order_lines_required',
  'CA-07: an order has at least one service');

-- Editing an open order (CA-08) --------------------------------------------------------------------
select lives_ok(
  $$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       jsonb_build_array(
         jsonb_build_object('id', pg_temp.line_of('o1', 1), 'price', 20000, 'estimated_minutes', 30),
         jsonb_build_object('name', 'Pulido de farolas', 'price', 8000, 'estimated_minutes', 20)),
       p_discount => 3000, p_id => pg_temp.id_of('o1')) $$,
  'CA-08: staff change a price, remove a line, add «Otro» and a discount');
select results_eq(
  $$ select name, price, service_id is null from public.work_order_lines
     where work_order_id = pg_temp.id_of('o1') order by position $$,
  $$ values ('WO Lavado', 20000, false), ('Pulido de farolas', 8000, true) $$,
  'CA-08: the order keeps exactly the lines sent');
reset role;
update public.services set disabled_at = now(), estimated_minutes = 45 where name = 'WO Lavado';
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-00000000a8b1');
select lives_ok(
  $$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       jsonb_build_array(
         jsonb_build_object('id', pg_temp.line_of('o1', 1), 'price', 20000, 'estimated_minutes', 30),
         jsonb_build_object('id', pg_temp.line_of('o1', 2), 'name', 'Pulido de farolas', 'price', 8000,
           'estimated_minutes', 20)),
       p_discount => 3000, p_id => pg_temp.id_of('o1')) $$,
  'RN-04: a line of a service disabled later is kept when the order is edited');
select is(
  (select estimated_minutes::int from public.work_order_lines where id = pg_temp.line_of('o1', 1)),
  30,
  'CA-31: changing the service time does not change the line');
select results_eq(
  $$ select subtotal, discount, total, estimated_minutes, unestimated
     from public.work_order_summaries where id = pg_temp.id_of('o1') $$,
  $$ values (28000::bigint, 3000, 25000::bigint, 50::bigint, '{}'::text[]) $$,
  'CA-25, CA-29: subtotal 20.000 + 8.000 = 28.000, minus 3.000 = 25.000; 30 + 20 = 50 minutes');

-- Closing ------------------------------------------------------------------------------------------
select is(
  pg_temp.error_hint($$ select public.close_work_order(pg_temp.id_of('o1'),
     jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 25000))) $$),
  'work_order_line_without_employees',
  'CA-12: an order with a line without employees cannot be closed');
select lives_ok(
  $$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       jsonb_build_array(
         jsonb_build_object('id', pg_temp.line_of('o1', 1), 'price', 20000, 'estimated_minutes', 30,
           'employees', jsonb_build_array(pg_temp.share('WO Elena', 80), pg_temp.share('WO Pedro', 20))),
         jsonb_build_object('id', pg_temp.line_of('o1', 2), 'name', 'Pulido de farolas', 'price', 8000,
           'employees', jsonb_build_array(pg_temp.share('WO Pedro', 100)))),
       p_discount => 3000, p_id => pg_temp.id_of('o1')) $$,
  'CA-06: shares of 80 % and 20 %');
select is(
  pg_temp.error_hint($$ select public.close_work_order(pg_temp.id_of('o1'),
     jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 20000))) $$),
  'work_order_payments_mismatch',
  'CA-12, RN-09: payments must add up to the total');
select lives_ok(
  $$ select public.close_work_order(pg_temp.id_of('o1'), jsonb_build_array(
       jsonb_build_object('method', 'cash', 'amount', 15000),
       jsonb_build_object('method', 'transfer', 'amount', 10000))) $$,
  'CA-11: an order is closed with two payment methods adding up to the total');
select results_eq(
  $$ select o.status::text, o.closed_by, (select count(*)::int from public.work_order_payments p where p.work_order_id = o.id)
     from public.work_orders o where o.id = pg_temp.id_of('o1') $$,
  $$ values ('closed', '00000000-0000-0000-0000-00000000a8b1'::uuid, 2) $$,
  'CA-11: the order is closed, with who closed it and both payments');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
     jsonb_build_array(jsonb_build_object('id', pg_temp.line_of('o1', 1), 'price', 1)), p_id => pg_temp.id_of('o1')) $$),
  'work_order_not_open',
  'CA-14: a closed order can no longer be edited');
select lives_ok(
  $$ select pg_temp.remember('o2', public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
       jsonb_build_array(jsonb_build_object('name', 'Lavado de cortesía', 'price', 0,
         'employees', jsonb_build_array(pg_temp.share('WO Elena', 100)))))) $$,
  'a courtesy line of $ 0 is valid');
select is(
  (select plate_city_name from public.work_order_summaries where id = pg_temp.id_of('o2')),
  'Bogotá, D.C.',
  'a car order carries the city of its plate, to draw it as on the customer record');
select results_eq(
  $$ select total, unestimated from public.work_order_summaries where id = pg_temp.id_of('o2') $$,
  $$ values (0::bigint, array['Lavado de cortesía']) $$,
  'CA-30: a line without time is named as not estimated');
select lives_ok(
  $$ select public.close_work_order(pg_temp.id_of('o2'), '[]'::jsonb) $$,
  'CA-13: an order of $ 0 closes without payments');

-- Queue and in progress (HU-07) --------------------------------------------------------------------
select is(
  (select started_at from public.work_orders where id = pg_temp.id_of('o1')),
  null,
  'CA-35: an order can be closed without being started');
select lives_ok(
  $$ select pg_temp.remember('o4', public.save_work_order(pg_temp.id_of('carla'), pg_temp.id_of('carla_car'),
       jsonb_build_array(jsonb_build_object('name', 'Encerado', 'price', 20000, 'estimated_minutes', 40)))) $$,
  'CA-32: a new order is open and not started: in the queue');
select lives_ok(
  $$ select public.start_work_order(pg_temp.id_of('o4')) $$,
  'CA-33: staff start an order in the queue');
select results_eq(
  $$ select o.started_by, o.started_at is not null, s.started_by_name from public.work_orders o
     join public.work_order_summaries s using (id) where o.id = pg_temp.id_of('o4') $$,
  $$ values ('00000000-0000-0000-0000-00000000a8b1'::uuid, true, 'Oscar Operador') $$,
  'CA-33: it records when it started and who started it');
select is(
  pg_temp.error_hint($$ select public.start_work_order(pg_temp.id_of('o4')) $$),
  'work_order_already_started',
  'CA-36: an order is started only once');
select is(
  pg_temp.error_hint($$ select public.start_work_order(pg_temp.id_of('o2')) $$),
  'work_order_not_open',
  'CA-36: a closed order is not started');

-- Voiding and correcting -----------------------------------------------------------------------------
select is(
  pg_temp.error_hint($$ select public.correct_work_order(pg_temp.id_of('o1'),
     jsonb_build_array(jsonb_build_object('id', pg_temp.line_of('o1', 1), 'price', 1)), '[]'::jsonb, 'Error') $$),
  'work_order_admin_only',
  'CA-22, RN-05: an operator cannot correct a closed order');
select is(
  pg_temp.error_hint($$ select public.void_work_order(pg_temp.id_of('o1'), 'Error') $$),
  'work_order_admin_only',
  'CA-23, RN-05: an operator cannot void a closed order');
select lives_ok(
  $$ select pg_temp.remember('o3', public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
       jsonb_build_array(jsonb_build_object('name', 'Revisión', 'price', 5000)))) $$,
  'the vehicle is free again once its order is closed');
select is(
  pg_temp.error_hint($$ select public.void_work_order(pg_temp.id_of('o3'), '   ') $$),
  'work_order_reason_required',
  'CA-21: voiding needs a reason');
select lives_ok(
  $$ select public.void_work_order(pg_temp.id_of('o3'), 'El cliente se fue sin el servicio') $$,
  'CA-21, CA-35: staff void an open order with a reason, without starting it');
select results_eq(
  $$ select status::text, voided_by, void_reason from public.work_orders where id = pg_temp.id_of('o3') $$,
  $$ values ('voided', '00000000-0000-0000-0000-00000000a8b1'::uuid, 'El cliente se fue sin el servicio') $$,
  'CA-21: the order is voided with who and why');
select is(
  pg_temp.error_hint($$ select public.void_work_order(pg_temp.id_of('o3'), 'Otra vez') $$),
  'work_order_already_voided',
  'a voided order never changes again');
select results_eq(
  $$ select opened_by_name, voided_by_name from public.work_order_summaries where id = pg_temp.id_of('o3') $$,
  $$ values ('Oscar Operador', 'Oscar Operador') $$,
  'CA-20: an operator sees who opened and voided an order (names only, not the profiles)');

select pg_temp.act_as('00000000-0000-0000-0000-00000000a8a1');
select is(
  pg_temp.error_hint($$ select public.correct_work_order(pg_temp.id_of('o1'),
     jsonb_build_array(jsonb_build_object('id', pg_temp.line_of('o1', 1), 'price', 1)), '[]'::jsonb, ' ') $$),
  'work_order_reason_required',
  'CA-22: correcting needs a reason');
select lives_ok(
  $$ select public.correct_work_order(pg_temp.id_of('o1'),
       jsonb_build_array(
         jsonb_build_object('id', pg_temp.line_of('o1', 1), 'price', 22000,
           'employees', jsonb_build_array(pg_temp.share('WO Elena', 100))),
         jsonb_build_object('id', pg_temp.line_of('o1', 2), 'name', 'Pulido de farolas', 'price', 8000,
           'employees', jsonb_build_array(pg_temp.share('WO Pedro', 100)))),
       jsonb_build_array(jsonb_build_object('method', 'card', 'amount', 27000)),
       'Se cobró el lavado completo', p_discount => 3000) $$,
  'CA-22: an admin corrects a closed order with a reason');
select results_eq(
  $$ select s.total, o.corrected_by, o.correction_reason from public.work_orders o
     join public.work_order_summaries s on s.id = o.id where o.id = pg_temp.id_of('o1') $$,
  $$ values (27000::bigint, '00000000-0000-0000-0000-00000000a8a1'::uuid, 'Se cobró el lavado completo') $$,
  'CA-22: the new total (22.000 + 8.000 − 3.000) and who corrected it, and why');
select lives_ok(
  $$ select public.void_work_order(pg_temp.id_of('o1'), 'Orden duplicada') $$,
  'CA-23: an admin voids a closed order with a reason');
select throws_ok(
  $$ delete from public.work_orders where id = pg_temp.id_of('o1') $$,
  '42501', null, 'CA-24, RN-06: not even an admin deletes an order');
select throws_ok(
  $$ update public.work_orders set discount = 0 where id = pg_temp.id_of('o2') $$,
  '42501', null, 'CA-14: not even an admin writes an order directly');

-- As a customer ------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-00000000a8c1');
select is_empty($$ select 1 from public.work_orders $$, 'a customer reads no order (not even their own)');
select is_empty($$ select 1 from public.work_order_summaries $$, 'a customer reads no summary');
select is(
  pg_temp.error_hint($$ select public.save_work_order(pg_temp.id_of('camilo'), pg_temp.id_of('camilo_moto'),
     jsonb_build_array(jsonb_build_object('name', 'Mío', 'price', 1))) $$),
  'work_order_staff_only',
  'a customer cannot open an order');
select is(
  pg_temp.error_hint($$ select public.start_work_order(pg_temp.id_of('o4')) $$),
  'work_order_staff_only',
  'a customer cannot start an order');

reset role;
select * from finish();
rollback;
