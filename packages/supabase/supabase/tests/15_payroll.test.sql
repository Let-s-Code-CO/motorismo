-- Payroll — what each employee earns in a fortnight or between two dates: base salary for the days
-- they were active plus the commissions of the services they took part in (spec 016; by fortnight,
-- spec 020).
--
-- * Base salary (spec 016, HU-01): a private column of the employee, 0 by default, never negative;
--   only an admin reads or writes it.
-- * Active periods (spec 016, RN-04): registering, disabling and reactivating an employee keep their
--   periods; only an admin reads them and nobody writes them directly.
-- * A period (spec 020, HU-01, HU-02): a fortnight (1st to 15th, 16th to the last day) or any two
--   dates, both included; the services of the orders closed in it, by their day in Colombia (CA-02,
--   CA-07); commission = value × share × commission %, discount ignored, rounded once per employee
--   (RN-01); who appears (CA-04). A range exactly a fortnight is that fortnight (CA-08).
-- * Base salary of a period (RN-02), cut by fortnight, each piece with the chosen method:
--   - «Mes comercial» (commercial): a whole fortnight, active all of it, is 15 days of 30 (half the
--     salary, also in February or a 31-day month); otherwise salary ÷ 30 per active day, at most 15
--     (CA-14, CA-15);
--   - «Días reales» (actual): salary × active days ÷ days of the month.
-- * Closing (HU-03): only a fortnight that has ended, never a range (CA-08, CA-11, RN-04); it keeps
--   its method (CA-16); a closed fortnight stays as it was, says when something changed after (with
--   the method it was closed with) and is regenerated with the method chosen then (CA-12, CA-16).
-- * Admin only, in the database (spec 016, RN-08).
--
-- The clock: everything that looks at the time asks private.agenda_now(); here it reads `test.now`,
-- so «today» is Thursday 5 December 2030 in Bogotá unless a step says otherwise.
begin;
create extension if not exists pgtap with schema extensions;

select plan(69);

-- Clock and helpers ---------------------------------------------------------------------------------------
create or replace function private.agenda_now()
returns timestamptz language sql stable set search_path = '' as $$
  select current_setting('test.now')::timestamptz;
$$;
create function pg_temp.at(p_local text)
returns void language sql as $$ select set_config('test.now', p_local || '-05', true); $$;
select pg_temp.at('2030-12-05 10:00');

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

-- Independent of the seeds: no orders, reservations or employees to start with.
delete from public.reservation_extensions;
delete from public.reservation_services;
delete from public.reservations;
delete from public.work_order_payments;
delete from public.work_order_line_employees;
delete from public.work_order_lines;
delete from public.work_orders;
delete from public.employee_active_periods;
delete from public.employee_details;
delete from public.employees;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000016a1', 'py-admin@test.local', 'Pia Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000016b1', 'py-op@test.local', 'Omar Operador', 'operator');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                        raw_user_meta_data, email_confirmed_at, created_at)
values ('00000000-0000-0000-0000-0000000016c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'py-camilo@test.local', '', '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', 'Camilo Cliente', 'data_consent', true), now(), now());
select pg_temp.remember('camilo', (select id from public.customers where email = 'py-camilo@test.local'));

-- Employees, written directly (setup): registered (and maybe disabled) at a given time, with their
-- private details.
create function pg_temp.employee(p_name text, p_created text, p_disabled text, p_base int, p_pct int, p_doc text)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into public.employees (full_name, created_at, disabled_at)
  values (p_name, p_created::timestamptz, p_disabled::timestamptz) returning id into v_id;
  insert into public.employee_details (employee_id, document_type, document_number, commission_pct, base_salary)
  values (v_id, 'cc', p_doc, p_pct, p_base);
  return pg_temp.remember(p_name, v_id);
end $$;

-- Elkin: all November. Paula: from 16 Nov at 8:30 p. m. (15 of 30 days: still the 16th in Colombia, the
-- 17th in UTC). Diego: until 10 Nov at 8 p. m. (10 days; the 11th in UTC).
-- Rita: until 5 Nov, back on 25 Nov, a pause on 27 Nov (5 + 6 = 11 days; the 27th once).
-- Olga: disabled in October, but took part in a service in November. Gael: registered on 2 December.
-- Hugo: registered on 17 December (15 of the 16 days of its second fortnight).
select pg_temp.employee('PY Elkin', '2030-10-01 08:00-05', null, 1500000, 30, '1001');
select pg_temp.employee('PY Paula', '2030-11-16 20:30-05', null, 1200000, 40, '1002');
select pg_temp.employee('PY Diego', '2030-10-01 08:00-05', '2030-11-10 20:00-05', 900000, 25, '1003');
select pg_temp.employee('PY Rita', '2030-10-01 08:00-05', null, 600000, 10, '1004');
select pg_temp.employee('PY Olga', '2030-01-01 08:00-05', '2030-10-15 12:00-05', 500000, 20, '1005');
select pg_temp.employee('PY Gael', '2030-12-02 08:00-05', null, 700000, 30, '1006');
select pg_temp.employee('PY Hugo', '2030-12-17 08:00-05', null, 900000, 20, '1008');
update public.employees set disabled_at = '2030-11-05 12:00-05' where id = pg_temp.id_of('PY Rita');
select pg_temp.at('2030-11-25 09:00');
update public.employees set disabled_at = null where id = pg_temp.id_of('PY Rita');
update public.employees set disabled_at = '2030-11-27 10:00-05' where id = pg_temp.id_of('PY Rita');
select pg_temp.at('2030-11-27 11:00');
update public.employees set disabled_at = null where id = pg_temp.id_of('PY Rita');
select pg_temp.at('2030-12-05 10:00');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select pg_temp.remember('moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'PYA12B'));
reset role;

-- Orders, written directly (setup), as in the services report's test.
create function pg_temp.order(p_name text, p_status text, p_closed text, p_discount int)
returns uuid language sql as $$
  with o as (
    insert into public.work_orders (customer_id, vehicle_id, opened_at, opened_by, status, discount,
                                    closed_at, closed_by, voided_at, voided_by, void_reason)
    select pg_temp.id_of('camilo'), pg_temp.id_of('moto'), coalesce(p_closed::timestamptz, now()) - interval '2 hours',
           '00000000-0000-0000-0000-0000000016a1', p_status::public.work_order_status, p_discount,
           case when p_status <> 'open' then p_closed::timestamptz end,
           case when p_status <> 'open' then '00000000-0000-0000-0000-0000000016a1'::uuid end,
           case when p_status = 'voided' then p_closed::timestamptz end,
           case when p_status = 'voided' then '00000000-0000-0000-0000-0000000016a1'::uuid end,
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

-- November 2030: the first minute (with a $ 10.000 discount); the last minute of the first fortnight and
-- the first of the second (CA-02); the last minutes of the month, one just after; one voided, one open.
select pg_temp.order('o_first', 'closed', '2030-11-01 00:05-05', 10000);
select pg_temp.line('o_first', 1, 'Lavado', 100000, '{"PY Elkin": 50, "PY Diego": 50}');
select pg_temp.order('o_q1_end', 'closed', '2030-11-15 23:59-05', 0);
select pg_temp.line('o_q1_end', 1, 'Lavado', 20000, '{"PY Elkin": 100}');
select pg_temp.order('o_q2_start', 'closed', '2030-11-16 00:00-05', 0);
select pg_temp.line('o_q2_start', 1, 'Lavado', 30000, '{"PY Elkin": 100}');
select pg_temp.order('o_mid', 'closed', '2030-11-18 12:00-05', 0);
select pg_temp.line('o_mid', 1, 'Cadena', 33335, '{"PY Elkin": 100}');
select pg_temp.line('o_mid', 2, 'Pulido', 10005, '{"PY Elkin": 100}');
select pg_temp.order('o_olga', 'closed', '2030-11-20 12:00-05', 0);
select pg_temp.line('o_olga', 1, 'Lavado', 40000, '{"PY Olga": 100}');
select pg_temp.order('o_last', 'closed', '2030-11-30 23:50-05', 0);
select pg_temp.line('o_last', 1, 'Micropulido', 120000, '{"PY Paula": 100}');
select pg_temp.order('o_after', 'closed', '2030-12-01 00:10-05', 0);
select pg_temp.line('o_after', 1, 'Lavado', 50000, '{"PY Elkin": 100}');
select pg_temp.order('o_void', 'voided', '2030-11-20 10:00-05', 0);
select pg_temp.line('o_void', 1, 'Lavado', 80000, '{"PY Elkin": 100}');
select pg_temp.order('o_open', 'open', null, 0);
select pg_temp.line('o_open', 1, 'Lavado', 70000, '{"PY Elkin": 100}');

-- Base salary (spec 016, HU-01) --------------------------------------------------------------------------------------
select col_type_is('public', 'employee_details', 'base_salary', 'integer', 'spec 016, CA-01: a base salary in whole pesos');
select col_default_is('public', 'employee_details', 'base_salary', '0', 'CA-03: 0 until the admin sets it');
select throws_ok(
  $$ update public.employee_details set base_salary = -1 where employee_id = pg_temp.id_of('PY Elkin') $$,
  '23514', null, 'CA-02: never negative');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select pg_temp.remember('nina', public.save_employee('PY Nina', 'cc', '1007', 20, p_base_salary => 1300000));
select is((select base_salary from public.employee_details where employee_id = pg_temp.id_of('nina')),
  1300000, 'CA-01: save_employee keeps the base salary');
select public.save_employee('PY Nina Nueva', 'cc', '1007', 25, p_id => pg_temp.id_of('nina'));
select is((select base_salary from public.employee_details where employee_id = pg_temp.id_of('nina')),
  1300000, 'CA-01: a correction without a base salary keeps the one it had');

select pg_temp.act_as('00000000-0000-0000-0000-0000000016b1');
select is((select count(*)::int from public.employee_details), 0,
  'CA-04: an operator reads no base salary (nor any private detail)');
update public.employee_details set base_salary = 1 where employee_id = pg_temp.id_of('PY Elkin');
reset role;
select is((select base_salary from public.employee_details where employee_id = pg_temp.id_of('PY Elkin')),
  1500000, 'CA-04: nor changes one');
-- Nina was registered with the real clock: out of the way of the months below.
delete from public.employee_active_periods where employee_id = pg_temp.id_of('nina');
delete from public.employee_details where employee_id = pg_temp.id_of('nina');
delete from public.employees where id = pg_temp.id_of('nina');

-- Active periods (spec 016, RN-04) ------------------------------------------------------------------------------------
select results_eq(
  $$ select started_at, ended_at from public.employee_active_periods where employee_id = pg_temp.id_of('PY Diego') $$,
  $$ values ('2030-10-01 08:00-05'::timestamptz, '2030-11-10 20:00-05'::timestamptz) $$,
  'registering opens a period; registered disabled, it is closed');
select results_eq(
  $$ select started_at, ended_at from public.employee_active_periods
     where employee_id = pg_temp.id_of('PY Rita') order by started_at $$,
  $$ values ('2030-10-01 08:00-05'::timestamptz, '2030-11-05 12:00-05'::timestamptz),
            ('2030-11-25 09:00-05'::timestamptz, '2030-11-27 10:00-05'::timestamptz),
            ('2030-11-27 11:00-05'::timestamptz, null::timestamptz) $$,
  'disabling closes the period, reactivating opens a new one');
select table_privs_are('public', 'employee_active_periods', 'authenticated', array['SELECT'],
  'nobody writes the periods directly');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016b1');
select is((select count(*)::int from public.employee_active_periods), 0, 'an operator reads no period');

-- The closed payrolls, by fortnight (RF-02, CA-16) ------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
reset role;
select has_column('public', 'payrolls', 'period_start', 'RF-02: a closed payroll is a fortnight, by its first day');
select has_column('public', 'payrolls', 'base_method', 'CA-16: and keeps the method it was closed with');
select hasnt_column('public', 'payrolls', 'month', 'RF-02: no closed months any more');
select has_column('public', 'payroll_lines', 'paid_days', 'CA-04: each line keeps the days its base salary paid');
select has_column('public', 'payroll_lines', 'divisor', 'CA-04: and what they were divided by');
select hasnt_function('public', 'payroll_month', array['date'], 'RF-01: no payroll by month any more');
select throws_ok(
  $$ insert into public.payrolls (period_start, period_end, base_method, closed_by, closed_at)
     values ('2030-11-02', '2030-11-15', 'commercial', '00000000-0000-0000-0000-0000000016a1', now()) $$,
  '23514', null, 'RF-01: a fortnight starts on the 1st or the 16th');
select throws_ok(
  $$ insert into public.payrolls (period_start, period_end, base_method, closed_by, closed_at)
     values ('2030-11-16', '2030-11-29', 'commercial', '00000000-0000-0000-0000-0000000016a1', now()) $$,
  '23514', null, 'RF-01: and ends on the 15th or the last day of its month');
select throws_ok(
  $$ insert into public.payrolls (period_start, period_end, base_method, closed_by, closed_at)
     values ('2030-11-16', '2030-11-30', 'weekly', '00000000-0000-0000-0000-0000000016a1', now()) $$,
  '23514', null, 'RN-02: with one of the two methods');

-- A fortnight (HU-01) ----------------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select results_eq(
  $$ select employee_name, active_days, period_days, base_salary, base_pay, commission_pct, commissions, total
     from public.payroll_lines('2030-11-01', '2030-11-15', 'commercial') $$,
  $$ values
     ('PY Diego'::text, 10, 15, 900000, 300000, 25, 12500, 312500),
     ('PY Elkin'::text, 15, 15, 1500000, 750000, 30, 21000, 771000),
     ('PY Rita'::text, 5, 15, 600000, 100000, 10, 0, 100000) $$,
  'CA-01, CA-03, CA-15: the first fortnight of November: Elkin all of it (15 of 30 days, half), Diego 10 days (900 000 ÷ 30 × 10), Rita 5; Paula (from the 16th) and Olga (nothing in it) are not there');
select results_eq(
  $$ select employee_name, active_days, period_days, base_salary, base_pay, commission_pct, commissions, total
     from public.payroll_lines('2030-11-16', '2030-11-30', 'commercial') $$,
  $$ values
     ('PY Elkin'::text, 15, 15, 1500000, 750000, 30, 22002, 772002),
     ('PY Olga'::text, 0, 15, 500000, 0, 20, 8000, 8000),
     ('PY Paula'::text, 15, 15, 1200000, 600000, 40, 48000, 648000),
     ('PY Rita'::text, 6, 15, 600000, 120000, 10, 0, 120000) $$,
  'CA-03, CA-04: the second: Paula from 8:30 p. m. of the 16th (all 15 days), Rita 6 days after coming back (the 27th once), Olga only for her commission; Diego (gone on the 10th) is not there');
select results_eq(
  $$ select service_name, closed_at from public.payroll_items('2030-11-01', '2030-11-15', pg_temp.id_of('PY Elkin')) $$,
  $$ values ('Lavado'::text, '2030-11-01 00:05-05'::timestamptz), ('Lavado'::text, '2030-11-15 23:59-05'::timestamptz) $$,
  'CA-02: 11:59 p. m. of the 15th in Colombia is the first fortnight (already the 16th in UTC)');
select results_eq(
  $$ select service_name, price, share_pct, commission from public.payroll_items('2030-11-16', '2030-11-30', pg_temp.id_of('PY Elkin')) $$,
  $$ values ('Lavado'::text, 30000, 100, 9000.0000::numeric), ('Cadena'::text, 33335, 100, 10000.5000::numeric),
            ('Pulido'::text, 10005, 100, 3001.5000::numeric) $$,
  'CA-02, RN-01: midnight of the 16th is the second; 1 Dec, voided and open orders left out');
select is(
  (select commissions from public.payroll_lines('2030-11-16', '2030-11-30', 'commercial') where employee_name = 'PY Elkin'),
  22002, 'RN-01: 9 000 + 10 000.5 + 3 001.5 = 22 002, rounded once (per service it would be 22 003)');

-- The method (HU-04) ---------------------------------------------------------------------------------------------
select results_eq(
  $$ select employee_name, active_days, period_days, base_pay
     from public.payroll_lines('2030-12-16', '2030-12-31', 'commercial') $$,
  $$ values ('PY Elkin'::text, 16, 16, 750000), ('PY Gael'::text, 16, 16, 350000), ('PY Hugo'::text, 15, 16, 450000),
            ('PY Paula'::text, 16, 16, 600000), ('PY Rita'::text, 16, 16, 300000) $$,
  'CA-14, CA-15: second fortnight of December (16 days), commercial: whole, half (1 500 000 ÷ 2); Hugo 15 of 16 days, 15 at most (900 000 ÷ 30 × 15)');
select results_eq(
  $$ select employee_name, base_pay from public.payroll_lines('2030-12-16', '2030-12-31', 'actual') $$,
  $$ values ('PY Elkin'::text, 774194), ('PY Gael'::text, 361290), ('PY Hugo'::text, 435484),
            ('PY Paula'::text, 619355), ('PY Rita'::text, 309677) $$,
  'CA-14, CA-15: the same in actual days: 1 500 000 × 16 ÷ 31 = 774 193.5; 700 000 × 16 ÷ 31 = 361 290.3; 900 000 × 15 ÷ 31 = 435 483.9');
select results_eq(
  $$ select active_days, period_days, base_pay from public.payroll_lines('2031-02-16', '2031-02-28', 'commercial')
     where employee_name = 'PY Elkin' $$,
  $$ values (13, 13, 750000) $$,
  'CA-14: the whole second fortnight of February (13 days) is half the salary too');
select is(
  (select base_pay from public.payroll_lines('2031-02-16', '2031-02-28', 'actual') where employee_name = 'PY Elkin'),
  696429, 'CA-14: in actual days, 1 500 000 × 13 ÷ 28 = 696 428.6');
select results_eq(
  $$ select active_days, base_pay from public.payroll_lines('2030-12-01', '2030-12-15', 'commercial')
     where employee_name = 'PY Gael' $$,
  $$ values (14, 326667) $$,
  'CA-15: Gael from the 2nd, 14 days of the first fortnight: 700 000 ÷ 30 × 14 = 326 666.7');
select is(
  (select base_pay from public.payroll_lines('2030-12-01', '2030-12-15', 'actual') where employee_name = 'PY Gael'),
  316129, 'CA-15: in actual days, 700 000 × 14 ÷ 31 = 316 129');

-- A range (HU-02) --------------------------------------------------------------------------------------------------
select results_eq(
  $$ select employee_name, active_days, period_days, base_pay, commissions, total
     from public.payroll_lines('2030-11-03', '2030-11-20', 'commercial') $$,
  $$ values
     ('PY Diego'::text, 8, 18, 240000, 0, 240000),
     ('PY Elkin'::text, 18, 18, 900000, 28002, 928002),
     ('PY Olga'::text, 0, 18, 0, 8000, 8000),
     ('PY Paula'::text, 5, 18, 200000, 0, 200000),
     ('PY Rita'::text, 3, 18, 60000, 0, 60000) $$,
  'CA-06, CA-07: 3 to 20 November, both included: Elkin 13 + 5 days of two fortnights, neither whole (1 500 000 ÷ 30 × 18); the orders of the 15th, the 16th, the 18th and the 20th; not the 1st nor the 30th');
select results_eq(
  $$ select part_from, part_to, part_days, active_days, paid_days, divisor, amount
     from public.payroll_base_parts('2030-11-03', '2030-11-20', 'commercial', pg_temp.id_of('PY Elkin')) $$,
  $$ values ('2030-11-03'::date, '2030-11-15'::date, 13, 13, 13, 30, 650000::numeric),
            ('2030-11-16'::date, '2030-11-20'::date, 5, 5, 5, 30, 250000::numeric) $$,
  'CA-04, RN-02: how it was reached, a piece per fortnight it touches');
select results_eq(
  $$ select part_from, part_to, paid_days, divisor, round(amount, 2)
     from public.payroll_base_parts('2030-11-25', '2030-12-05', 'actual', pg_temp.id_of('PY Elkin')) $$,
  $$ values ('2030-11-25'::date, '2030-11-30'::date, 6, 30, 300000.00::numeric),
            ('2030-12-01'::date, '2030-12-05'::date, 5, 31, 241935.48::numeric) $$,
  'RN-02: a range across two months divides each piece by the days of its own month');
select is(
  (select base_pay from public.payroll_lines('2030-11-25', '2030-12-05', 'actual') where employee_name = 'PY Elkin'),
  541935, 'RN-01: 300 000 + 241 935.48, rounded once');
select results_eq(
  $$ select kind, status, method, total, can_close from public.payroll_period('2030-11-03', '2030-11-20', 'commercial') $$,
  $$ values ('range'::text, 'query'::text, 'commercial'::text, 1436002, false) $$,
  'CA-08: a range is a query and is never closed');
select results_eq(
  $$ select kind, status, total, can_close from public.payroll_period('2030-11-01', '2030-11-15', 'commercial') $$,
  $$ values ('fortnight'::text, 'provisional'::text, 1183500, true) $$,
  'CA-05, CA-08: from the 1st to the 15th is that fortnight: provisional, ended, it may be closed');
select is(pg_temp.error_hint($$ select public.payroll_period('2030-11-20', '2030-11-03', 'commercial') $$),
  'payroll_period_invalid', 'CA-09: never a range upside down');
select is(pg_temp.error_hint($$ select public.payroll_lines('2030-11-01', '2030-11-15', 'weekly') $$),
  'payroll_method_invalid', 'RN-02: only the two methods');

-- Closing (HU-03) ----------------------------------------------------------------------------------------------------
select results_eq(
  $$ select status, can_close from public.payroll_period('2030-12-01', '2030-12-15', 'commercial') $$,
  $$ values ('provisional'::text, false) $$,
  'RN-04: the fortnight in progress cannot be closed');
select is(pg_temp.error_hint($$ select public.close_payroll('2030-12-01', 'commercial') $$), 'payroll_period_open',
  'CA-11, RN-04: nor when asked');
select is(pg_temp.error_hint($$ select public.close_payroll('2030-11-02', 'commercial') $$), 'payroll_not_fortnight',
  'RF-02: only a fortnight is closed');
select is(pg_temp.error_hint($$ select public.close_payroll('2030-11-01', 'weekly') $$), 'payroll_method_invalid',
  'RN-02: with one of the two methods');

-- October, second fortnight (16 days), closed in actual days: 774 194 + 464 516 + 309 677.
select lives_ok($$ select public.close_payroll('2030-10-16', 'actual') $$, 'CA-11: an ended fortnight is closed');
select results_eq(
  $$ select status, method, total, changed_since_close from public.payroll_period('2030-10-16', '2030-10-31', 'commercial') $$,
  $$ values ('closed'::text, 'actual'::text, 1548387, false) $$,
  'CA-16: it keeps and says the method it was closed with, whichever is chosen to look at it');
select results_eq(
  $$ select part_from, part_to, part_days, active_days, paid_days, divisor, amount
     from public.payroll_base_parts('2030-10-16', '2030-10-31', 'commercial', pg_temp.id_of('PY Elkin')) $$,
  $$ values ('2030-10-16'::date, '2030-10-31'::date, 16, 16, 16, 31, 774194::numeric) $$,
  'CA-04, CA-12: its detail explains the base salary with what was kept (× 16 ÷ 31)');
select lives_ok($$ select public.regenerate_payroll('2030-10-16', 'commercial') $$,
  'CA-16: it is regenerated with the method chosen then');
select results_eq(
  $$ select method, total, previous_total from public.payroll_period('2030-10-16', '2030-10-31', 'actual') $$,
  $$ values ('commercial'::text, 1500000, 1548387) $$,
  'CA-16: 750 000 + 450 000 + 300 000 by commercial month, the total before kept');

select lives_ok($$ select public.close_payroll('2030-11-16', 'commercial') $$, 'CA-11: the second of November');
select results_eq(
  $$ select status, total, closed_by_name, closed_at, changed_since_close, can_close
     from public.payroll_period('2030-11-16', '2030-11-30', 'commercial') $$,
  $$ values ('closed'::text, 1548002, 'Pia Admin'::text, '2030-12-05 10:00-05'::timestamptz, false, false) $$,
  'CA-12: closed by whom and when, with its total');
select is(pg_temp.error_hint($$ select public.close_payroll('2030-11-16', 'commercial') $$), 'payroll_already_closed',
  'CA-11: a fortnight is closed once');

-- Something changes after closing: an order of the fortnight corrected, Paula's base salary, Elkin's commission.
reset role;
update public.work_order_lines set price = 150000 where work_order_id = pg_temp.id_of('o_last');
update public.employee_details set base_salary = 1300000 where employee_id = pg_temp.id_of('PY Paula');
update public.employee_details set commission_pct = 35 where employee_id = pg_temp.id_of('PY Elkin');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select results_eq(
  $$ select employee_name, base_pay, commission_pct, commissions, total
     from public.payroll_lines('2030-11-16', '2030-11-30', 'commercial') where employee_name in ('PY Elkin', 'PY Paula') $$,
  $$ values ('PY Elkin'::text, 750000, 30, 22002, 772002), ('PY Paula'::text, 600000, 40, 48000, 648000) $$,
  'CA-12: a closed fortnight stays as it was closed');
select is(
  (select sum(commission) from public.payroll_items('2030-11-16', '2030-11-30', pg_temp.id_of('PY Elkin'))),
  22002.0000::numeric, 'CA-12: its detail too');
select is((select changed_since_close from public.payroll_period('2030-11-16', '2030-11-30', 'commercial')), true,
  'CA-12: it says something changed after closing');

select is(pg_temp.error_hint($$ select public.regenerate_payroll('2030-11-01', 'commercial') $$), 'payroll_not_closed',
  'CA-12: only a closed fortnight is regenerated');
select pg_temp.at('2030-12-06 09:00');
select lives_ok($$ select public.regenerate_payroll('2030-11-16', 'commercial') $$, 'CA-12: a closed fortnight is regenerated');
-- Paula: 1 300 000 ÷ 2 = 650 000 + 150 000 × 40 % = 60 000. Elkin at 35 %: 10 500 + 11 667.25 + 3 501.75.
select results_eq(
  $$ select employee_name, base_pay, commission_pct, commissions, total
     from public.payroll_lines('2030-11-16', '2030-11-30', 'commercial') where employee_name in ('PY Elkin', 'PY Paula') $$,
  $$ values ('PY Elkin'::text, 750000, 35, 25669, 775669), ('PY Paula'::text, 650000, 40, 60000, 710000) $$,
  'CA-12: regenerating computes it again with the data of now');
select results_eq(
  $$ select status, total, previous_total, regenerated_by_name, regenerated_at, closed_at, changed_since_close
     from public.payroll_period('2030-11-16', '2030-11-30', 'commercial') $$,
  $$ values ('closed'::text, 1613669, 1548002, 'Pia Admin'::text, '2030-12-06 09:00-05'::timestamptz,
             '2030-12-05 10:00-05'::timestamptz, false) $$,
  'CA-12: who regenerated it and when, and the total before; nothing changed since');

-- Only the detail changes: Elkin's two services of o_mid swap their values (same sum, same total).
reset role;
update public.work_order_lines set price = case name when 'Cadena' then 10005 else 33335 end
 where work_order_id = pg_temp.id_of('o_mid');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select is((select changed_since_close from public.payroll_period('2030-11-16', '2030-11-30', 'commercial')), true,
  'CA-12: a change in the detail alone is a change too');
select public.regenerate_payroll('2030-11-16', 'commercial');
reset role;
update public.work_orders
   set status = 'voided', voided_at = '2030-12-06 10:00-05', voided_by = '00000000-0000-0000-0000-0000000016a1',
       void_reason = 'Duplicada'
 where id = pg_temp.id_of('o_olga');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select is((select changed_since_close from public.payroll_period('2030-11-16', '2030-11-30', 'commercial')), true,
  'CA-12: an order of the fortnight voided after closing is a change');

-- Who may (spec 016, RN-08) ------------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000016b1');
select is(pg_temp.error_hint($$ select public.payroll_period('2030-11-16', '2030-11-30', 'commercial') $$),
  'payroll_admin_only', 'RN-08: an operator gets no payroll');
select is(pg_temp.error_hint($$ select public.close_payroll('2030-11-01', 'commercial') $$), 'payroll_admin_only',
  'RN-08: nor closes one');
select is(pg_temp.error_hint($$ select public.regenerate_payroll('2030-11-16', 'commercial') $$), 'payroll_admin_only',
  'RN-08: nor regenerates one');
select is((select count(*)::int from public.payrolls), 0, 'RN-08: nor reads the closed ones');
select pg_temp.act_as('00000000-0000-0000-0000-0000000016c1');
select is(pg_temp.error_hint($$ select public.payroll_lines('2030-11-16', '2030-11-30', 'commercial') $$),
  'payroll_admin_only', 'RN-08: nor a customer');
select is(pg_temp.error_hint($$ select public.payroll_base_parts('2030-11-16', '2030-11-30', 'commercial', pg_temp.id_of('PY Elkin')) $$),
  'payroll_admin_only', 'RN-08: nor how a base salary was reached');
reset role;

select table_privs_are('public', 'payrolls', 'authenticated', array['SELECT'], 'RN-04: nobody writes a payroll directly');
select table_privs_are('public', 'payroll_lines', 'authenticated', array['SELECT'], 'RN-04: nor its lines');
select function_privs_are('public', 'close_payroll', array['date', 'text'], 'anon', array[]::text[], 'anon cannot close');

select * from finish();
rollback;
