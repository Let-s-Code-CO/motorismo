-- Payroll — what each employee earns in a month: base salary for the days they were active plus the
-- commissions of the services they took part in (spec 016).
--
-- * Base salary (HU-01): a private column of the employee, 0 by default, never negative; only an
--   admin reads or writes it (CA-01 to CA-04).
-- * Active periods (RN-04): registering, disabling and reactivating an employee keep their periods;
--   only an admin reads them and nobody writes them directly.
-- * A month (HU-02): commission = value × share × commission %, discount ignored, closed orders of
--   the month in Colombia only (CA-06 to CA-08); base salary × active days ÷ days of the month
--   (CA-09); who appears (CA-10); rounded once per employee (RN-05).
-- * Closing (HU-03): only an ended month; a closed month stays as it was, says when something
--   changed after, and is regenerated on request, keeping the total before (CA-14 to CA-17).
-- * Admin only, in the database (CA-20, RN-08).
--
-- The clock: everything that looks at the time asks private.agenda_now(); here it reads `test.now`,
-- so «today» is Thursday 5 December 2030 in Bogotá unless a step says otherwise.
begin;
create extension if not exists pgtap with schema extensions;

select plan(42);

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
-- Olga: disabled in October, but took part in a service in November. Gael: registered in December.
select pg_temp.employee('PY Elkin', '2030-10-01 08:00-05', null, 1500000, 30, '1001');
select pg_temp.employee('PY Paula', '2030-11-16 20:30-05', null, 1200000, 40, '1002');
select pg_temp.employee('PY Diego', '2030-10-01 08:00-05', '2030-11-10 20:00-05', 900000, 25, '1003');
select pg_temp.employee('PY Rita', '2030-10-01 08:00-05', null, 600000, 10, '1004');
select pg_temp.employee('PY Olga', '2030-01-01 08:00-05', '2030-10-15 12:00-05', 500000, 20, '1005');
select pg_temp.employee('PY Gael', '2030-12-02 08:00-05', null, 700000, 30, '1006');
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

-- November 2030: the first minute (with a $ 10.000 discount), the last minutes, one just after; one
-- voided, one open.
select pg_temp.order('o_first', 'closed', '2030-11-01 00:05-05', 10000);
select pg_temp.line('o_first', 1, 'Lavado', 100000, '{"PY Elkin": 50, "PY Diego": 50}');
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

-- Base salary (HU-01) --------------------------------------------------------------------------------------
select col_type_is('public', 'employee_details', 'base_salary', 'integer', 'CA-01: a base salary in whole pesos');
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

-- Active periods (RN-04) ------------------------------------------------------------------------------------
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

-- A month (HU-02) ----------------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select results_eq(
  $$ select employee_name, active_days, month_days, base_salary, base_pay, commission_pct, commissions, total
     from public.payroll_lines('2030-11-01') $$,
  $$ values
     ('PY Diego'::text, 10, 30, 900000, 300000, 25, 12500, 312500),
     ('PY Elkin'::text, 30, 30, 1500000, 1500000, 30, 28002, 1528002),
     ('PY Olga'::text, 0, 30, 500000, 0, 20, 8000, 8000),
     ('PY Paula'::text, 15, 30, 1200000, 600000, 40, 48000, 648000),
     ('PY Rita'::text, 11, 30, 600000, 220000, 10, 0, 220000) $$,
  'CA-05, CA-09, CA-10: each employee of November with days, base for those days, commissions and total; Gael (registered in December) is not there');
select results_eq(
  $$ select service_name, price, share_pct, commission from public.payroll_items('2030-11-01', pg_temp.id_of('PY Elkin')) $$,
  $$ values ('Lavado'::text, 100000, 50, 15000.0000::numeric), ('Cadena'::text, 33335, 100, 10000.5000::numeric),
            ('Pulido'::text, 10005, 100, 3001.5000::numeric) $$,
  'CA-06, CA-07, CA-08: 100 000 × 50 % × 30 % = 15 000 though the order had a discount; 1 Dec, voided and open orders left out');
select is(
  (select commissions from public.payroll_lines('2030-11-01') where employee_name = 'PY Elkin'),
  28002, 'RN-05: 15 000 + 10 000.5 + 3 001.5 = 28 002, rounded once (per service it would be 28 003)');
select is(
  (select commissions from public.payroll_lines('2030-11-01') where employee_name = 'PY Paula'),
  48000, 'CA-08: an order closed at 11:50 p. m. on the 30th counts in November (120 000 × 40 %)');
select results_eq(
  $$ select active_days, month_days, base_pay from public.payroll_lines('2031-02-01') where employee_name = 'PY Elkin' $$,
  $$ values (28, 28, 1500000) $$,
  'CA-09: February has 28 days; all of them, the whole base salary');
select results_eq(
  $$ select active_days, month_days from public.payroll_lines('2030-12-01') where employee_name = 'PY Gael' $$,
  $$ values (30, 31) $$,
  'CA-09: December has 31 days; registered on the 2nd, 30 of them');
select results_eq(
  $$ select status, total, can_close, changed_since_close from public.payroll_month('2030-11-01') $$,
  $$ values ('provisional'::text, 2716502, true, false) $$,
  'CA-12: an ended month not closed is provisional and may be closed; its total for everyone');
select results_eq(
  $$ select status, can_close from public.payroll_month('2030-12-15') $$,
  $$ values ('provisional'::text, false) $$,
  'RN-06: the month in progress cannot be closed (any day of it names the month)');

-- Closing (HU-03) -----------------------------------------------------------------------------------------------
select is(pg_temp.error_hint($$ select public.close_payroll('2030-12-01') $$), 'payroll_month_open',
  'CA-14, RN-06: a month that has not ended is not closed');
select lives_ok($$ select public.close_payroll('2030-11-01') $$, 'CA-14: an ended month is closed');
select results_eq(
  $$ select status, total, closed_by_name, closed_at, changed_since_close, can_close from public.payroll_month('2030-11-01') $$,
  $$ values ('closed'::text, 2716502, 'Pia Admin'::text, '2030-12-05 10:00-05'::timestamptz, false, false) $$,
  'CA-14: closed by whom and when, with its total');
select is(pg_temp.error_hint($$ select public.close_payroll('2030-11-01') $$), 'payroll_already_closed',
  'CA-14: a month is closed once');

-- Something changes after closing: an order of November corrected, Paula's base salary, Elkin's commission.
reset role;
update public.work_order_lines set price = 150000 where work_order_id = pg_temp.id_of('o_last');
update public.employee_details set base_salary = 1300000 where employee_id = pg_temp.id_of('PY Paula');
update public.employee_details set commission_pct = 35 where employee_id = pg_temp.id_of('PY Elkin');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select results_eq(
  $$ select employee_name, base_pay, commission_pct, commissions, total from public.payroll_lines('2030-11-01')
     where employee_name in ('PY Elkin', 'PY Paula') $$,
  $$ values ('PY Elkin'::text, 1500000, 30, 28002, 1528002), ('PY Paula'::text, 600000, 40, 48000, 648000) $$,
  'CA-15, RN-07: a closed month stays as it was closed');
select is(
  (select sum(commission) from public.payroll_items('2030-11-01', pg_temp.id_of('PY Elkin'))),
  28002.0000::numeric, 'CA-15: its detail too');
select is((select changed_since_close from public.payroll_month('2030-11-01')), true,
  'CA-17: it says something changed after closing');

select is(pg_temp.error_hint($$ select public.regenerate_payroll('2030-10-01') $$), 'payroll_not_closed',
  'CA-16: only a closed month is regenerated');
select pg_temp.at('2030-12-06 09:00');
select lives_ok($$ select public.regenerate_payroll('2030-11-01') $$, 'CA-16: a closed month is regenerated');
-- Paula: 1 300 000 × 15 ÷ 30 = 650 000 + 150 000 × 40 % = 60 000. Elkin at 35 %: 17 500 + 11 667.25 + 3 501.75.
select results_eq(
  $$ select employee_name, base_pay, commission_pct, commissions, total from public.payroll_lines('2030-11-01')
     where employee_name in ('PY Elkin', 'PY Paula') $$,
  $$ values ('PY Elkin'::text, 1500000, 35, 32669, 1532669), ('PY Paula'::text, 650000, 40, 60000, 710000) $$,
  'CA-16: regenerating computes it again with the data of now');
select results_eq(
  $$ select status, total, previous_total, regenerated_by_name, regenerated_at, closed_at, changed_since_close
     from public.payroll_month('2030-11-01') $$,
  $$ values ('closed'::text, 2783169, 2716502, 'Pia Admin'::text, '2030-12-06 09:00-05'::timestamptz,
             '2030-12-05 10:00-05'::timestamptz, false) $$,
  'CA-16: who regenerated it and when, and the total before; nothing changed since');
select is(
  (select sum(commission) from public.payroll_items('2030-11-01', pg_temp.id_of('PY Elkin'))),
  32669.0000::numeric, 'CA-16: its detail is the new one');

-- Only the detail changes: Elkin's two services of o_mid swap their values (same sum, same total).
reset role;
update public.work_order_lines set price = case name when 'Cadena' then 10005 else 33335 end
 where work_order_id = pg_temp.id_of('o_mid');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000016a1');
select is((select changed_since_close from public.payroll_month('2030-11-01')), true,
  'CA-17: a change in the detail alone is a change too');

-- Who may (CA-20, RN-08) ----------------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000016b1');
select is(pg_temp.error_hint($$ select public.payroll_month('2030-11-01') $$), 'payroll_admin_only',
  'CA-20: an operator gets no payroll');
select is(pg_temp.error_hint($$ select public.close_payroll('2030-10-01') $$), 'payroll_admin_only',
  'CA-20: nor closes one');
select is(pg_temp.error_hint($$ select public.regenerate_payroll('2030-11-01') $$), 'payroll_admin_only',
  'CA-20: nor regenerates one');
select is((select count(*)::int from public.payrolls), 0, 'CA-20: nor reads the closed ones');
select pg_temp.act_as('00000000-0000-0000-0000-0000000016c1');
select is(pg_temp.error_hint($$ select public.payroll_lines('2030-11-01') $$), 'payroll_admin_only',
  'CA-20: nor a customer');
select is(pg_temp.error_hint($$ select public.payroll_items('2030-11-01', pg_temp.id_of('PY Elkin')) $$),
  'payroll_admin_only', 'CA-20: nor its detail');
reset role;

select table_privs_are('public', 'payrolls', 'authenticated', array['SELECT'], 'RN-07: nobody writes a payroll directly');
select table_privs_are('public', 'payroll_lines', 'authenticated', array['SELECT'], 'RN-07: nor its lines');
select table_privs_are('public', 'payroll_items', 'authenticated', array['SELECT'], 'RN-07: nor its detail');
select function_privs_are('public', 'close_payroll', array['date'], 'anon', array[]::text[], 'anon cannot close');

select * from finish();
rollback;
