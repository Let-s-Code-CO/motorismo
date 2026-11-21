-- catalogs — the services the business offers and the employees who do them (spec 007).
--
-- Staff pick from these lists when they register a work order (next spec). This file guards:
--   * the shape: services with one optional reference price per vehicle type (at least one,
--     whole pesos from 1 to 10,000,000, RN-05, CA-03); employees split into a name everyone on
--     the staff may read and private details (document, phone, commission) only an admin reads
--     (RN-07);
--   * the rules: a service name is unique ignoring case and extra spaces, also against disabled
--     ones (RN-03, CA-04); an employee is their document type and number, compared without dots
--     or spaces (RN-04, CA-09); the commission is a whole percentage from 0 to 100 (RN-06); the
--     guards say whether the existing one is disabled, so the app can suggest reactivating it;
--   * access: only an admin writes (RN-01, CA-17); an operator reads the active services and the
--     names of the active employees, nothing else (CA-15, CA-16); a customer and anon read
--     nothing (CA-18); nobody deletes, not even an admin (RN-02, CA-14);
--   * save_employee writes both tables or neither, and only for an admin.
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

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

-- The hint of the error a statement raises (null if it succeeds): the app maps hints to messages.
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
grant execute on function pg_temp.error_hint(text) to authenticated;

-- Independent of the seeds: start from empty catalogs (undone by the final rollback). The seed
-- work orders (spec 008) point at services and employees, so they go first.
-- Reservations (spec 012) point at services and orders: they go first.
delete from public.reservation_services;
delete from public.reservations;
delete from public.work_order_payments;
delete from public.work_order_line_employees;
delete from public.work_order_lines;
delete from public.work_orders;
delete from public.employee_details;
delete from public.employees;
delete from public.services;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000009a1', 'cat-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000009b1', 'cat-op@test.local', 'Oscar Operador', 'operator');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000009c1', 'cat-cliente@test.local', 'Camila Cliente');

-- Shape and access ---------------------------------------------------------------------------------
select has_table('public', 'services', 'the services table exists');
select has_table('public', 'employees', 'the employees table exists');
select has_table('public', 'employee_details', 'the employee details table exists');
select enum_has_labels('public', 'document_type', array['cc', 'ce', 'ppt', 'passport'],
  'documents: cédula de ciudadanía, cédula de extranjería, PPT and passport');
select ok(
  (select bool_and(relrowsecurity) from pg_class
    where oid in ('public.services'::regclass, 'public.employees'::regclass, 'public.employee_details'::regclass)),
  'RLS is enabled on the three tables'
);
select policies_are('public', 'services',
  array['services_select_staff', 'services_insert_admin', 'services_update_admin'],
  'services: staff read, only an admin inserts and updates');
select policies_are('public', 'employees',
  array['employees_select_staff', 'employees_insert_admin', 'employees_update_admin'],
  'employees: staff read, only an admin inserts and updates');
select policies_are('public', 'employee_details',
  array['employee_details_select_admin', 'employee_details_insert_admin', 'employee_details_update_admin'],
  'employee details: only an admin reads and writes (RN-07)');
select ok(
  not has_table_privilege('authenticated', 'public.services', 'DELETE')
  and not has_table_privilege('authenticated', 'public.employees', 'DELETE')
  and not has_table_privilege('authenticated', 'public.employee_details', 'DELETE'),
  'RN-02, CA-14: nobody can delete a service or an employee, they are only disabled'
);
select ok(
  not has_table_privilege('anon', 'public.services', 'SELECT')
  and not has_table_privilege('anon', 'public.employees', 'SELECT')
  and not has_table_privilege('anon', 'public.employee_details', 'SELECT'),
  'CA-18: anon reads nothing'
);

-- Services: prices and names (as the owner: the rules hold for everyone) --------------------------
select throws_ok(
  $$ insert into public.services (name) values ('Sin precio') $$,
  '23514', null, 'CA-03: a service needs at least one reference price');
select throws_ok(
  $$ insert into public.services (name, price_motorcycle) values ('Gratis', 0) $$,
  '23514', null, 'RN-05: a price is greater than zero');
select throws_ok(
  $$ insert into public.services (name, price_car) values ('Carísimo', 10000001) $$,
  '23514', null, 'RN-05: a price is at most $ 10.000.000');
select lives_ok(
  $$ insert into public.services (name, price_car) values ('Tope', 10000000) $$,
  'RN-05: $ 10.000.000 is allowed');
select throws_ok(
  $$ insert into public.services (name, price_car) values ('   ', 20000) $$,
  '23514', null, 'CA-03: a service needs a name');

insert into public.services (name, price_motorcycle, price_car, price_bicycle)
values ('  Lavado   sencillo ', 25000, 40000, null);
select is(
  (select name from public.services where name_key = 'lavado sencillo'),
  'Lavado   sencillo',
  'the name is kept trimmed at both ends');
select is(
  pg_temp.error_hint($$ insert into public.services (name, price_car) values ('lavado SENCILLO', 1) $$),
  'service_name_taken',
  'CA-04, RN-03: the same name ignoring case and extra spaces is taken');
insert into public.services (name, price_motorcycle) values ('Polichado', 30000);
update public.services set disabled_at = now() where name = 'Polichado';
select is(
  pg_temp.error_hint($$ insert into public.services (name, price_car) values ('POLICHADO', 1) $$),
  'service_name_taken_disabled',
  'CA-04: a name taken by a disabled service says so (the app suggests reactivating it)');
select is(
  pg_temp.error_hint($$ update public.services set name = 'Polichado' where name = 'Tope' $$),
  'service_name_taken_disabled',
  'CA-05: renaming follows the same rule');

-- Employees: document, phone and commission ------------------------------------------------------
insert into public.employees (id, full_name) values
  ('00000000-0000-0000-0000-00000000e001', 'Elena Empleada'),
  ('00000000-0000-0000-0000-00000000e002', 'Pedro Pasaporte'),
  ('00000000-0000-0000-0000-00000000e003', 'Diego Desactivado');
select throws_ok(
  $$ insert into public.employee_details (employee_id, document_type, document_number, commission_pct)
     values ('00000000-0000-0000-0000-00000000e001', 'cc', '1020304050', 101) $$,
  '23514', null, 'RN-06: the commission is at most 100');
select throws_ok(
  $$ insert into public.employee_details (employee_id, document_type, document_number, commission_pct)
     values ('00000000-0000-0000-0000-00000000e001', 'cc', '1020304050', -1) $$,
  '23514', null, 'RN-06: the commission is at least 0');
select throws_ok(
  $$ insert into public.employee_details (employee_id, document_type, document_number, phone, commission_pct)
     values ('00000000-0000-0000-0000-00000000e001', 'cc', '1020304050', '123', 30) $$,
  '23514', null, 'CA-08: the phone is a Colombian mobile');
select throws_ok(
  $$ insert into public.employee_details (employee_id, document_type, document_number, commission_pct)
     values ('00000000-0000-0000-0000-00000000e001', 'cc', 'AB1234', 30) $$,
  '23514', null, 'CA-08: a cédula has digits only');
insert into public.employee_details (employee_id, document_type, document_number, phone, commission_pct)
values ('00000000-0000-0000-0000-00000000e001', 'cc', '1.020.304.050', '3001112233', 30);
select is(
  (select document_number from public.employee_details where employee_id = '00000000-0000-0000-0000-00000000e001'),
  '1020304050',
  'CA-09: the document is kept without dots or spaces');
insert into public.employee_details (employee_id, document_type, document_number, commission_pct)
values ('00000000-0000-0000-0000-00000000e002', 'passport', 'ab 12345', 25);
select is(
  (select document_number from public.employee_details where employee_id = '00000000-0000-0000-0000-00000000e002'),
  'AB12345',
  'a passport number keeps its letters, in upper case');
select is(
  pg_temp.error_hint($$ insert into public.employee_details (employee_id, document_type, document_number, commission_pct)
     values ('00000000-0000-0000-0000-00000000e003', 'cc', '1020 304 050', 10) $$),
  'employee_document_taken',
  'CA-09, RN-04: the same document type and number is taken, with or without dots and spaces');
select lives_ok(
  $$ insert into public.employee_details (employee_id, document_type, document_number, commission_pct)
     values ('00000000-0000-0000-0000-00000000e003', 'ce', '1020304050', 10) $$,
  'RN-04: the same number with another document type is another person');
update public.employees set disabled_at = now() where id = '00000000-0000-0000-0000-00000000e003';
select is(
  pg_temp.error_hint($$ update public.employee_details set document_type = 'ce', document_number = '1020304050'
     where employee_id = '00000000-0000-0000-0000-00000000e001' $$),
  'employee_document_taken_disabled',
  'CA-09: a document taken by a disabled employee says so (the app suggests reactivating them)');

-- As an admin ------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000009a1');

select is(
  (select count(*)::int from public.services where name in ('Lavado   sencillo', 'Polichado')),
  2,
  'an admin reads the active and the disabled services');
select lives_ok(
  $$ select public.save_employee('Nina Nueva', 'ppt', '123456', 20, p_phone => '3105556677') $$,
  'CA-07: an admin registers an employee with save_employee');
select is(
  (select d.commission_pct::int from public.employees e join public.employee_details d on d.employee_id = e.id
    where e.full_name = 'Nina Nueva'),
  20,
  'save_employee writes the name and the private details together');
select lives_ok(
  $$ select public.save_employee('Nina Nueva', 'ppt', '123456', 35,
       p_id => (select id from public.employees where full_name = 'Nina Nueva')) $$,
  'CA-10: an admin corrects an employee');
select is(
  (select d.commission_pct::int || '/' || coalesce(d.phone, 'none') from public.employees e
    join public.employee_details d on d.employee_id = e.id where e.full_name = 'Nina Nueva'),
  '35/none',
  'CA-10: the correction is saved (commission 35, phone removed)');
select throws_ok(
  $$ select public.save_employee('Mala Comisión', 'cc', '99887766', 101) $$,
  '23514', null, 'an invalid detail fails the whole save');
select is(
  (select count(*)::int from public.employees where full_name = 'Mala Comisión'),
  0,
  'save_employee leaves no employee without details when it fails');
select lives_ok(
  $$ update public.services set disabled_at = now() where name = 'Tope' $$,
  'CA-12: an admin disables a service');
select lives_ok(
  $$ update public.services set disabled_at = null where name = 'Tope' $$,
  'CA-13: an admin reactivates it');
select throws_ok(
  $$ delete from public.services where name = 'Tope' $$,
  '42501', null, 'CA-14: not even an admin deletes a service');

-- As an operator ---------------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000009b1');

select is(
  (select array_agg(name order by name) from public.services),
  array['Lavado   sencillo', 'Tope'],
  'CA-15: an operator reads only the active services');
select is(
  (select array_agg(full_name order by full_name) from public.employees),
  array['Elena Empleada', 'Nina Nueva', 'Pedro Pasaporte'],
  'CA-16: an operator reads only the active employees');
select is_empty(
  $$ select 1 from public.employee_details $$,
  'CA-16, RN-07: an operator reads no document, phone or commission');
select throws_ok(
  $$ insert into public.services (name, price_car) values ('Del operador', 1000) $$,
  '42501', null, 'CA-17, RN-01: an operator cannot register a service');
select is_empty(
  $$ update public.services set disabled_at = now() returning id $$,
  'CA-17: an operator cannot disable a service (nothing is updated)');
select throws_ok(
  $$ select public.save_employee('Del Operador', 'cc', '55555555', 10) $$,
  '42501', null, 'CA-17: an operator cannot register an employee');

-- As a customer and as anon ------------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000009c1');

select is_empty($$ select 1 from public.services $$, 'CA-18: a customer reads no service');
select is_empty($$ select 1 from public.employees $$, 'CA-18: a customer reads no employee');
select throws_ok(
  $$ insert into public.services (name, price_car) values ('Del cliente', 1000) $$,
  '42501', null, 'CA-18: a customer cannot register a service');

reset role;
set local role anon;
select throws_ok(
  $$ select 1 from public.services $$,
  '42501', null, 'CA-18: anon cannot even ask for the services');

reset role;
select * from finish();
rollback;
