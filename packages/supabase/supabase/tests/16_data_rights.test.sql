-- Data subject rights — a customer's requests about their data, and erasing it (spec 017).
--
-- * Business days (RN-03): Colombian holidays for any year (fixed, moved to Monday, by Easter); a
--   deadline counts business days from the day after.
-- * Requests (HU-02 to HU-05): a customer asks for a correction (description required) or an erasure
--   (reason optional) from the app; an admin registers one for any customer from the counter or
--   Instagram; one open per kind (RN-02); withdrawn by its customer; attended or rejected by the
--   admin with an answer; once, for good, with who and when (CA-19).
-- * The list (CA-09): business days left, overdue.
-- * A customer's data (CA-01, CA-03, CA-17): everything of theirs, nothing internal.
-- * Erasure (RN-05 to RN-07): never with an open order; name, contact, account, plates, notes and
--   pending reservations gone; the orders kept for the business.
-- * Admin only, in the database (CA-15, RN-01).
--
-- The clock: private.agenda_now() reads `test.now`: Tuesday 24 November 2026, 10 a. m. in Bogotá.
begin;
create extension if not exists pgtap with schema extensions;

select plan(45);

-- Clock and helpers ---------------------------------------------------------------------------------------
create or replace function private.agenda_now()
returns timestamptz language sql stable set search_path = '' as $$
  select current_setting('test.now')::timestamptz;
$$;
create function pg_temp.at(p_local text)
returns void language sql as $$ select set_config('test.now', p_local || '-05', true); $$;
select pg_temp.at('2026-11-24 10:00');

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

create temp table t_ids (name text primary key, id uuid not null);
grant select, insert on t_ids to authenticated;
create function pg_temp.remember(p_name text, p_id uuid)
returns uuid language sql as $$ insert into t_ids values (p_name, p_id) returning id; $$;
create function pg_temp.id_of(p_name text)
returns uuid language sql stable as $$ select id from t_ids where name = p_name; $$;

-- Fixtures ----------------------------------------------------------------------------------------------
\set admin '''00000000-0000-0000-0000-0000000017a1'''
\set operator '''00000000-0000-0000-0000-0000000017b1'''
\set camilo_user '''00000000-0000-0000-0000-0000000017c1'''
\set lucia_user '''00000000-0000-0000-0000-0000000017c2'''

select pg_temp.new_staff(:admin, 'dr-admin@test.local', 'Ada Admin', 'admin');
select pg_temp.new_staff(:operator, 'dr-op@test.local', 'Omar Operador', 'operator');
select pg_temp.remember('camilo', pg_temp.new_customer(:camilo_user, 'dr-camilo@test.local', 'Camilo Cliente'));
select pg_temp.remember('lucia', pg_temp.new_customer(:lucia_user, 'dr-lucia@test.local', 'Lucía Cliente'));
insert into public.customers (full_name, phone, registered_by) values ('Valeria Ventanilla', '3101112222', :admin);
select pg_temp.remember('valeria', (select id from public.customers where full_name = 'Valeria Ventanilla'));
update public.customers set phone = '3009998877' where id = pg_temp.id_of('camilo');

insert into public.employees (full_name) values ('DR Elkin');
select pg_temp.remember('elkin', (select id from public.employees where full_name = 'DR Elkin'));

set local role authenticated;
select pg_temp.act_as(:admin);
select pg_temp.remember('moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'DRA12B'));
select pg_temp.remember('old_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha',
  p_line_name => 'MT-03', p_color => 'blue', p_plate => 'DRB34C'));
select pg_temp.remember('lucia_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('lucia'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'red', p_plate => 'DRC56D'));
reset role;
update public.vehicles set retired_at = now() where id = pg_temp.id_of('old_moto');

-- Orders, written directly (setup): Camilo, one closed (with an internal note and an employee) and
-- one voided; Lucía, one open.
create function pg_temp.order(p_name text, p_customer text, p_vehicle text, p_status text, p_notes text)
returns uuid language sql as $$
  with o as (
    insert into public.work_orders (customer_id, vehicle_id, opened_at, opened_by, status, notes, discount,
                                    closed_at, closed_by, voided_at, voided_by, void_reason)
    select pg_temp.id_of(p_customer), pg_temp.id_of(p_vehicle), '2026-11-10 09:00-05',
           '00000000-0000-0000-0000-0000000017a1', p_status::public.work_order_status, p_notes, 5000,
           case when p_status <> 'open' then '2026-11-10 11:00-05'::timestamptz end,
           case when p_status <> 'open' then '00000000-0000-0000-0000-0000000017a1'::uuid end,
           case when p_status = 'voided' then '2026-11-10 11:00-05'::timestamptz end,
           case when p_status = 'voided' then '00000000-0000-0000-0000-0000000017a1'::uuid end,
           case when p_status = 'voided' then 'Duplicada' end
    returning id)
  select pg_temp.remember(p_name, id) from o;
$$;
select pg_temp.order('o_closed', 'camilo', 'moto', 'closed', 'Pidió factura a nombre de su empresa');
select pg_temp.order('o_voided', 'camilo', 'moto', 'voided', null);
select pg_temp.order('o_open', 'lucia', 'lucia_moto', 'open', null);
insert into public.work_order_lines (work_order_id, position, name, price)
values (pg_temp.id_of('o_closed'), 1, 'Lavado detallado', 60000),
       (pg_temp.id_of('o_voided'), 1, 'Lavado sencillo', 25000),
       (pg_temp.id_of('o_open'), 1, 'Lavado sencillo', 25000);
insert into public.work_order_line_employees (line_id, employee_id, share_pct)
select id, pg_temp.id_of('elkin'), 100 from public.work_order_lines where work_order_id = pg_temp.id_of('o_closed');
insert into public.work_order_payments (work_order_id, method, amount)
values (pg_temp.id_of('o_closed'), 'cash', 55000);

-- Reservations, written directly: Camilo, one pending (with a note) and one cancelled.
insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, notes, created_by)
values (pg_temp.id_of('camilo'), pg_temp.id_of('moto'), '2026-11-30 10:00-05', '2026-11-30 11:00-05',
        'Llamar a Camilo al 300 999 8877', :admin);
insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, created_by, status,
                                 cancelled_at, cancelled_by, cancel_reason)
values (pg_temp.id_of('camilo'), pg_temp.id_of('moto'), '2026-11-20 10:00-05', '2026-11-20 11:00-05', :admin,
        'cancelled', '2026-11-19 10:00-05', :admin, 'Viaje');

-- Business days (RN-03) ------------------------------------------------------------------------------------
select results_eq(
  $$ select d from private.colombian_holidays(2026) d order by d $$,
  $$ values ('2026-01-01'::date), ('2026-01-12'), ('2026-03-23'), ('2026-04-02'), ('2026-04-03'),
            ('2026-05-01'), ('2026-05-18'), ('2026-06-08'), ('2026-06-15'), ('2026-06-29'),
            ('2026-07-20'), ('2026-08-07'), ('2026-08-17'), ('2026-10-12'), ('2026-11-02'),
            ('2026-11-16'), ('2026-12-08'), ('2026-12-25') $$,
  'RN-03: the 18 holidays of 2026: fixed, moved to Monday, and by Easter (5 April)');
select results_eq(
  $$ select d from private.colombian_holidays(2024) d where d between '2024-03-25' and '2024-04-01' order by d $$,
  $$ values ('2024-03-25'::date), ('2024-03-28'), ('2024-03-29') $$,
  'RN-03: with Easter on 31 March 2024, Holy Thursday and Friday fall in March (and Saint Joseph on Monday 25)');
select is(private.add_business_days('2026-11-24', 15), '2026-12-16'::date,
  'RN-03: 15 business days from Tuesday 24 Nov, skipping weekends and 8 Dec, end on 16 Dec');
select is(private.add_business_days('2026-11-24', 10), '2026-12-09'::date,
  'RN-03: 10 business days end on 9 Dec (8 Dec is a holiday)');

-- Requests (HU-02 to HU-04) --------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as(:camilo_user);
select is(pg_temp.error_hint($$ select public.request_data_change('correction', '   ') $$),
  'data_request_description_required', 'CA-04: a correction says what to correct');
select pg_temp.remember('camilo_fix', public.request_data_change('correction', 'Mi correo es otro'));
select results_eq(
  $$ select kind::text, channel::text, status::text, due_on, received_at from public.data_requests
     where id = pg_temp.id_of('camilo_fix') $$,
  $$ values ('correction', 'app', 'received', '2026-12-16'::date, '2026-11-24 10:00-05'::timestamptz) $$,
  'CA-04, RN-03: received from the app, answered by 16 Dec (15 business days)');
select is(pg_temp.error_hint($$ select public.request_data_change('correction', 'Otra cosa') $$),
  'data_request_open', 'CA-06, RN-02: one open request per kind');
select pg_temp.remember('camilo_erase', public.request_data_change('erasure', null));
select results_eq(
  $$ select kind::text, status::text, description, due_on from public.data_requests where id = pg_temp.id_of('camilo_erase') $$,
  $$ values ('erasure', 'received', null::text, '2026-12-16'::date) $$,
  'CA-05: an erasure without a reason, with its deadline');
select public.withdraw_data_request(pg_temp.id_of('camilo_fix'));
select results_eq(
  $$ select status::text, resolved_by, resolved_at from public.data_requests where id = pg_temp.id_of('camilo_fix') $$,
  $$ values ('withdrawn', '00000000-0000-0000-0000-0000000017c1'::uuid, '2026-11-24 10:00-05'::timestamptz) $$,
  'CA-08: withdrawn by the customer');
select lives_ok($$ select pg_temp.remember('camilo_fix2', public.request_data_change('correction', 'Mi celular cambió')) $$,
  'CA-08: once withdrawn, another of that kind may be sent');

select pg_temp.act_as(:admin);
select pg_temp.remember('valeria_ask', public.register_data_request(
  pg_temp.id_of('valeria'), 'inquiry', 'counter', 'Quiere saber qué datos tenemos'));
select results_eq(
  $$ select kind::text, channel::text, due_on, created_by from public.data_requests where id = pg_temp.id_of('valeria_ask') $$,
  $$ values ('inquiry', 'counter', '2026-12-09'::date, '00000000-0000-0000-0000-0000000017a1'::uuid) $$,
  'CA-16, RN-03: an inquiry registered at the counter, answered by 9 Dec (10 business days)');
select is(pg_temp.error_hint($$ select public.register_data_request(pg_temp.id_of('valeria'), 'correction', 'app', 'x') $$),
  'data_request_channel_invalid', 'CA-16: the admin registers what came by the counter or Instagram');
select is(pg_temp.error_hint($$ select public.resolve_data_request(pg_temp.id_of('valeria_ask'), ' ') $$),
  'data_request_response_required', 'CA-11: attending needs an answer');
select public.resolve_data_request(pg_temp.id_of('valeria_ask'), 'Le entregamos el archivo con sus datos');
select results_eq(
  $$ select status::text, resolved_by, resolved_at, response from public.data_requests where id = pg_temp.id_of('valeria_ask') $$,
  $$ values ('attended', '00000000-0000-0000-0000-0000000017a1'::uuid, '2026-11-24 10:00-05'::timestamptz,
             'Le entregamos el archivo con sus datos') $$,
  'CA-17, CA-19: attended, by whom, when and with what answer');
select is(pg_temp.error_hint($$ select public.resolve_data_request(pg_temp.id_of('valeria_ask'), 'Otra vez') $$),
  'data_request_closed', 'CA-19: a closed request never changes');
select is(pg_temp.error_hint($$ select public.reject_data_request(pg_temp.id_of('camilo_fix2'), '') $$),
  'data_request_response_required', 'CA-14: rejecting needs a reason');
select is(pg_temp.error_hint($$ select public.resolve_data_request(pg_temp.id_of('camilo_erase'), 'Listo') $$),
  'data_request_wrong_kind', 'CA-12: an erasure is attended by erasing, not by an answer');
select public.reject_data_request(pg_temp.id_of('camilo_fix2'), 'El celular ya está bien en su perfil');
select is((select status::text from public.data_requests where id = pg_temp.id_of('camilo_fix2')), 'rejected',
  'CA-14: rejected with its reason');

-- The list (CA-09): on 10 Dec, a correction due on 16 Dec and an inquiry due on 9 Dec.
select pg_temp.remember('valeria_fix', public.register_data_request(
  pg_temp.id_of('valeria'), 'correction', 'instagram', 'Su apellido está mal escrito'));
select pg_temp.remember('valeria_ask2', public.register_data_request(
  pg_temp.id_of('valeria'), 'inquiry', 'counter', 'Pide sus datos otra vez'));
select pg_temp.at('2026-12-10 09:00');
select results_eq(
  $$ select kind::text, customer_name, business_days_left, overdue from public.data_request_summaries
     where customer_id = pg_temp.id_of('valeria') and status = 'received' order by due_on $$,
  $$ values ('inquiry', 'Valeria Ventanilla', 0, true), ('correction', 'Valeria Ventanilla', 4, false) $$,
  'CA-09: the inquiry is overdue; the correction has 4 business days left (11, 14, 15 and 16 Dec)');

-- A customer's data (CA-01, CA-03, CA-17) -------------------------------------------------------------------
select pg_temp.act_as(:camilo_user);
select results_eq(
  $$ select d -> 'profile' ->> 'full_name', d -> 'profile' ->> 'email', d -> 'profile' ->> 'phone',
            d -> 'profile' ->> 'origin', (d -> 'profile' ->> 'consent_at') is not null
     from public.my_data() d $$,
  $$ values ('Camilo Cliente', 'dr-camilo@test.local', '3009998877', 'self_signup', true) $$,
  'CA-01: their profile, how their account was made and when they authorised the processing');
select results_eq(
  $$ select jsonb_array_length(d -> 'vehicles'), jsonb_array_length(d -> 'orders'),
            jsonb_array_length(d -> 'reservations'), jsonb_array_length(d -> 'requests')
     from public.my_data() d $$,
  $$ values (2, 2, 2, 3) $$,
  'CA-01: also the retired vehicle, the voided order, the cancelled reservation and every request');
select results_eq(
  $$ select o ->> 'status', (o ->> 'total')::int, jsonb_array_length(o -> 'services'), jsonb_array_length(o -> 'payments')
     from public.my_data() d, jsonb_array_elements(d -> 'orders') o order by o ->> 'status' $$,
  $$ values ('closed', 55000, 1, 1), ('voided', 20000, 1, 0) $$,
  'CA-01: each order with its services, payments and total (60 000 − 5 000 = 55 000)');
select ok(
  (select d::text not like '%DR Elkin%' and d::text not like '%factura%' and d::text not like '%Ada Admin%'
   from public.my_data() d),
  'CA-03: nothing internal: no employee, no note of an order, no staff name');
select pg_temp.act_as(:lucia_user);
select ok((select d::text not like '%DRA12B%' and d::text not like '%Camilo%' from public.my_data() d),
  'CA-03: never another customer''s data');
select pg_temp.act_as(:admin);
select is((select d -> 'profile' ->> 'full_name' from public.customer_data(pg_temp.id_of('valeria')) d),
  'Valeria Ventanilla', 'CA-17: the admin gets the data of a customer without account');
select pg_temp.act_as(:camilo_user);
select is(pg_temp.error_hint($$ select public.customer_data(pg_temp.id_of('lucia')) $$),
  'data_request_admin_only', 'CA-15: a customer never gets another''s data file');

-- Erasure (RN-05 to RN-07) ------------------------------------------------------------------------------------
select pg_temp.act_as(:lucia_user);
select pg_temp.remember('lucia_erase', public.request_data_change('erasure', 'Ya no uso el servicio'));
select pg_temp.act_as(:admin);
select is(pg_temp.error_hint($$ select public.erase_customer_data(pg_temp.id_of('lucia_erase')) $$),
  'data_erasure_open_order', 'CA-13, RN-07: never with an open order');

select is(
  (select count(*)::int from public.service_report('2026-11-01', '2026-11-30') where customer_name = 'Camilo Cliente'),
  1, 'before: the services report shows Camilo''s closed order');
select lives_ok($$ select public.erase_customer_data(pg_temp.id_of('camilo_erase')) $$, 'CA-12: the admin erases');
reset role;
select results_eq(
  $$ select full_name, email, phone, avatar_url, user_id, disabled_at is not null, erased_at is not null
     from public.customers where id = pg_temp.id_of('camilo') $$,
  $$ values ('Cliente suprimido', null::text, null::text, null::text, null::uuid, true, true) $$,
  'RN-05: «Cliente suprimido», no contact, no photo, no account, disabled');
select is((select count(*)::int from auth.users where id = :camilo_user), 0,
  'RN-05: their account is gone (they cannot sign in)');
select results_eq(
  $$ select count(*)::int, count(*) filter (where plate is not null)::int, count(*) filter (where retired_at is null)::int
     from public.vehicles where customer_id = pg_temp.id_of('camilo') $$,
  $$ values (2, 0, 0) $$,
  'RN-05: their vehicles retired, without plates (also the one retired before)');
select results_eq(
  $$ select status::text, notes, cancel_reason from public.reservations where customer_id = pg_temp.id_of('camilo') order by slot_start $$,
  $$ values ('cancelled', null::text, 'Viaje'), ('cancelled', null::text, 'Supresión de datos') $$,
  'RN-05: the pending reservation cancelled, notes emptied');
select results_eq(
  $$ select count(*)::int, count(notes)::int from public.work_orders where customer_id = pg_temp.id_of('camilo') $$,
  $$ values (2, 0) $$,
  'RN-05: the orders are kept, their notes emptied');
select results_eq(
  $$ select customer_name, price from public.service_report('2026-11-01', '2026-11-30')
     where order_id = pg_temp.id_of('o_closed') $$,
  $$ values ('Cliente suprimido', 60000) $$,
  'RN-05: the business keeps the service and its value, without the name');
select results_eq(
  $$ select status::text, description, response from public.data_requests
     where customer_id = pg_temp.id_of('camilo') order by status::text $$,
  $$ values ('attended', null::text, 'Datos suprimidos'), ('rejected', null::text, null::text),
            ('withdrawn', null::text, null::text) $$,
  'CA-20, RN-06: their requests keep no personal data; the erasure says «Datos suprimidos»');

-- Who may (CA-15, RN-01) --------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as(:operator);
select is((select count(*)::int from public.data_requests), 0, 'CA-15: an operator reads no request');
select is((select count(*)::int from public.data_request_summaries), 0, 'CA-15: nor the list');
select is(pg_temp.error_hint($$ select public.register_data_request(pg_temp.id_of('valeria'), 'inquiry', 'counter', 'x') $$),
  'data_request_admin_only', 'CA-15: nor registers one');
select pg_temp.act_as(:lucia_user);
select is((select count(*)::int from public.data_requests), 1, 'RN-01: a customer reads only theirs');
select is(pg_temp.error_hint($$ select public.withdraw_data_request(pg_temp.id_of('valeria_fix')) $$),
  'data_request_not_found', 'RN-01: nor withdraws another''s');
reset role;

select ok((select relrowsecurity from pg_class where oid = 'public.data_requests'::regclass), 'RLS is on');
select table_privs_are('public', 'data_requests', 'authenticated', array['SELECT'],
  'CA-19: nobody writes a request directly');
select table_privs_are('public', 'data_requests', 'anon', array[]::text[], 'anon has nothing');
select function_privs_are('public', 'erase_customer_data', array['uuid'], 'anon', array[]::text[],
  'anon cannot erase');

select * from finish();
rollback;
