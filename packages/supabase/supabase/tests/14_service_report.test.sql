-- service_report — the services done in closed orders, for the admin (spec 015).
--
-- * One row per line of a closed order (never an open or voided one), dated by the order's closing
--   day in Colombia, both ends of the range included (RN-01, CA-02, CA-07); its value and employees
--   as they are in the order, corrected ones included (RN-02).
-- * Filters: an employee (the lines they took part in, also if disabled) and a plate (whole,
--   normalized: with or without dash, any case), together (CA-03 to CA-05).
-- * Newest first, a page at a time; with no limit, every row, for the Excel (CA-01, CA-11, CA-12).
-- * Totals of the whole filter: how many and their sum; the discounts of those orders and the total
--   only without an employee filter (CA-06, RN-03).
-- * Admin only: an operator or a customer are refused, and anon cannot even call it (RN-04).
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

create function pg_temp.new_staff(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role) values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', '{}');
  update public.profiles set status = 'active' where id = p_id;
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

-- Independent of the seeds: no orders to start with.
delete from public.reservation_extensions;
delete from public.reservation_services;
delete from public.reservations;
delete from public.work_order_payments;
delete from public.work_order_line_employees;
delete from public.work_order_lines;
delete from public.work_orders;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000015a1', 'sr-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000015b1', 'sr-op@test.local', 'Oscar Operador', 'operator');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                        raw_user_meta_data, email_confirmed_at, created_at)
values ('00000000-0000-0000-0000-0000000015c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'sr-camilo@test.local', '', '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', 'Camilo Cliente', 'data_consent', true), now(), now());
select pg_temp.remember('camilo', (select id from public.customers where email = 'sr-camilo@test.local'));

insert into public.employees (full_name) values ('SR Elkin'), ('SR Paula'), ('SR Diego');
update public.employees set disabled_at = now() where full_name = 'SR Diego';
select pg_temp.remember(full_name, id) from public.employees where full_name like 'SR %';

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000015a1');
select pg_temp.remember('moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'SRA12B'));
select pg_temp.remember('car', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'car', p_vehicle_class => 'utility', p_brand_name => 'Mazda',
  p_line_name => 'CX-30', p_color => 'gray', p_plate => 'SRB123', p_plate_city_code => '11001'));
reset role;

-- Orders, written directly (setup): status, closing time (Bogotá), discount, and lines with employees.
create function pg_temp.order(p_name text, p_vehicle text, p_status text, p_closed text, p_discount int)
returns uuid language sql as $$
  with o as (
    insert into public.work_orders (customer_id, vehicle_id, opened_at, opened_by, status, discount,
                                    closed_at, closed_by, voided_at, voided_by, void_reason)
    select pg_temp.id_of('camilo'), pg_temp.id_of(p_vehicle), coalesce(p_closed::timestamptz, now()) - interval '2 hours',
           '00000000-0000-0000-0000-0000000015a1', p_status::public.work_order_status, p_discount,
           case when p_status <> 'open' then p_closed::timestamptz end,
           case when p_status <> 'open' then '00000000-0000-0000-0000-0000000015a1'::uuid end,
           case when p_status = 'voided' then p_closed::timestamptz end,
           case when p_status = 'voided' then '00000000-0000-0000-0000-0000000015a1'::uuid end,
           case when p_status = 'voided' then 'Error' end
    returning id)
  select pg_temp.remember(p_name, id) from o;
$$;
create function pg_temp.line(p_order text, p_position int, p_name text, p_price int, p_employees jsonb)
returns void language plpgsql as $$
declare v_line uuid;
begin
  insert into public.work_order_lines (work_order_id, position, name, price)
  values (pg_temp.id_of(p_order), p_position, p_name, p_price) returning id into v_line;
  insert into public.work_order_line_employees (line_id, employee_id, share_pct)
  select v_line, pg_temp.id_of(e.key), e.value::int from jsonb_each_text(p_employees) e;
end $$;

-- November 2030 in Bogotá: 1 Nov (first day), 15 Nov (with discount), 30 Nov 23:30 (last day,
-- late), 1 Dec 00:10 (just after the range); one voided, one open.
select pg_temp.order('o_first', 'moto', 'closed', '2030-11-01 09:00-05', 0);
select pg_temp.line('o_first', 1, 'Lavado', 25000, '{"SR Elkin": 100}');
select pg_temp.order('o_mid', 'car', 'closed', '2030-11-15 12:00-05', 5000);
select pg_temp.line('o_mid', 1, 'Lavado', 40000, '{"SR Elkin": 50, "SR Paula": 50}');
select pg_temp.line('o_mid', 2, 'Micropulido', 120000, '{"SR Diego": 100}');
select pg_temp.order('o_late', 'moto', 'closed', '2030-11-30 23:30-05', 0);
select pg_temp.line('o_late', 1, 'Cadena', 15000, '{"SR Paula": 100}');
select pg_temp.order('o_after', 'moto', 'closed', '2030-12-01 00:10-05', 0);
select pg_temp.line('o_after', 1, 'Lavado', 25000, '{"SR Elkin": 100}');
select pg_temp.order('o_void', 'moto', 'voided', '2030-11-20 10:00-05', 0);
select pg_temp.line('o_void', 1, 'Lavado', 25000, '{"SR Elkin": 100}');
select pg_temp.order('o_open', 'car', 'open', null, 0);
select pg_temp.line('o_open', 1, 'Lavado', 40000, '{"SR Elkin": 100}');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000015a1');

-- Rows ---------------------------------------------------------------------------------------------------
select results_eq(
  $$ select order_id, service_name, price from public.service_report('2030-11-01', '2030-11-30', null, null) $$,
  $$ values (pg_temp.id_of('o_late'), 'Cadena'::text, 15000),
            (pg_temp.id_of('o_mid'), 'Lavado'::text, 40000),
            (pg_temp.id_of('o_mid'), 'Micropulido'::text, 120000),
            (pg_temp.id_of('o_first'), 'Lavado'::text, 25000) $$,
  'CA-01, CA-02, CA-07: newest first; both ends in Colombia (30 Nov 11:30 p. m. in, 1 Dec 12:10 a. m. out); no voided or open');
select results_eq(
  $$ select customer_name, vehicle_type, brand_name, line_name, plate, employees
     from public.service_report('2030-11-15', '2030-11-15', null, null) where service_name = 'Lavado' $$,
  $$ values ('Camilo Cliente'::text, 'car'::text, 'Mazda'::text, 'CX-30'::text, 'SRB123'::text,
             '[{"name": "SR Elkin", "share": 50}, {"name": "SR Paula", "share": 50}]'::jsonb) $$,
  'CA-01: the customer, the vehicle and its plate, and the employees with their share');
select is(
  (select order_number from public.service_report('2030-11-01', '2030-11-01', null, null)),
  (select number from public.work_orders where id = pg_temp.id_of('o_first')),
  'CA-10: each row says its order');

-- Filters --------------------------------------------------------------------------------------------------
select results_eq(
  $$ select order_id, service_name from public.service_report('2030-11-01', '2030-11-30', pg_temp.id_of('SR Paula'), null) $$,
  $$ values (pg_temp.id_of('o_late'), 'Cadena'::text), (pg_temp.id_of('o_mid'), 'Lavado'::text) $$,
  'CA-03: only the services the employee took part in');
select results_eq(
  $$ select service_name from public.service_report('2030-11-01', '2030-11-30', pg_temp.id_of('SR Diego'), null) $$,
  $$ values ('Micropulido'::text) $$,
  'CA-03: also a disabled employee');
select results_eq(
  $$ select order_id from public.service_report('2030-11-01', '2030-11-30', null, 'sra-12b') $$,
  $$ values (pg_temp.id_of('o_late')), (pg_temp.id_of('o_first')) $$,
  'CA-04: a plate with dash and in lower case');
select is_empty(
  $$ select 1 from public.service_report('2030-11-01', '2030-11-30', null, 'SRA') $$,
  'CA-04: the whole plate, never part of it');
select results_eq(
  $$ select service_name from public.service_report('2030-11-01', '2030-11-30', pg_temp.id_of('SR Elkin'), 'SRB-123') $$,
  $$ values ('Lavado'::text) $$,
  'CA-05: the filters together');

-- Pages ----------------------------------------------------------------------------------------------------
select results_eq(
  $$ select service_name from public.service_report('2030-11-01', '2030-11-30', null, null, 2, 2) $$,
  $$ values ('Micropulido'::text), ('Lavado'::text) $$,
  'CA-11: a page: rows 3 and 4');
select is(
  (select count(*)::int from public.service_report('2030-11-01', '2030-11-30')),
  4, 'CA-12: with no limit, every row (for the Excel)');

-- Totals ---------------------------------------------------------------------------------------------------
select results_eq(
  $$ select services, subtotal, discounts, total from public.service_report_totals('2030-11-01', '2030-11-30', null, null) $$,
  $$ values (4, 200000, 5000, 195000) $$,
  'CA-06, CA-11: 15 000 + 40 000 + 120 000 + 25 000 = 200 000; the discount of o_mid, once: 195 000');
select results_eq(
  $$ select services, subtotal, discounts, total from public.service_report_totals('2030-11-01', '2030-11-30', pg_temp.id_of('SR Elkin'), null) $$,
  $$ values (2, 65000, null::integer, null::integer) $$,
  'CA-06, RN-03: with an employee, only how many and their sum (25 000 + 40 000); no discounts');
select results_eq(
  $$ select services, subtotal, discounts, total from public.service_report_totals('2030-11-01', '2030-11-30', null, 'SRB123') $$,
  $$ values (2, 160000, 5000, 155000) $$,
  'CA-06: with a plate the orders are whole: 40 000 + 120 000 − 5 000');

-- Corrected values (CA-07, RN-02) ------------------------------------------------------------------------------
reset role;
update public.work_order_lines set price = 30000 where work_order_id = pg_temp.id_of('o_first');
update public.work_orders set corrected_at = now(), corrected_by = '00000000-0000-0000-0000-0000000015a1',
       correction_reason = 'Valor acordado' where id = pg_temp.id_of('o_first');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000015a1');
select is(
  (select price from public.service_report('2030-11-01', '2030-11-01', null, null)),
  30000, 'CA-07, RN-02: a corrected order counts with its corrected value');

-- Who may (RN-04) ----------------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000015b1');
select is(pg_temp.error_hint($$ select public.service_report('2030-11-01', '2030-11-30', null, null) $$),
  'report_admin_only', 'CA-09: an operator gets no report');
select pg_temp.act_as('00000000-0000-0000-0000-0000000015c1');
select is(pg_temp.error_hint($$ select public.service_report_totals('2030-11-01', '2030-11-30', null, null) $$),
  'report_admin_only', 'CA-09, CA-14: nor a customer, nor their totals');
reset role;

select function_privs_are('public', 'service_report', array['date', 'date', 'uuid', 'text', 'integer', 'integer'],
  'anon', array[]::text[], 'anon cannot call it');

select * from finish();
rollback;
