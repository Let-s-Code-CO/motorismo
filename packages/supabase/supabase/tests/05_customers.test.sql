-- customers — the business's customers, with or without an account (spec 004).
--
-- A customer either signs up (email + password after confirming the email, or Google) or is
-- registered by staff at the counter without an account. This file guards:
--   * the shape of public.customers: generated status (registered / walk_in / disabled) and search
--     text, at least an email or a phone (RN-02), Colombian mobile normalised to 10 digits (RN-03),
--     lowercase email unique across the app (RN-01);
--   * a sign-up only becomes a customer once the email is confirmed (RN-07, CA-19), with the
--     consent date of the sign-up (RF-07);
--   * RLS + privileges: a customer only reads and edits their own row, and only their name and
--     phone (CA-10, CA-13, CA-14); they cannot read staff profiles (CA-11); staff (operator and
--     admin) read every customer; staff never appear as customers (CA-11);
--   * the search text ignores case and accents (CA-16), and the counts per status follow RLS;
--   * current_account() tells the proxy whether the session is staff or a customer;
--   * part B (HU-05..HU-07): Google sign-ups and their photo, counter registrations, the email
--     rules for staff edits, linking a counter record on sign-up and enabling/disabling.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Fixtures -------------------------------------------------------------------------------------
create function pg_temp.new_staff(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role) values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', '{}');
  update public.profiles set status = 'active' where id = p_id;
end $$;

-- A sign-up as Auth stores it (not confirmed yet).
create function pg_temp.sign_up(p_id uuid, p_email text, p_provider text, p_meta jsonb)
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                          raw_user_meta_data, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)), p_meta,
          '2026-11-01 10:00:00+00');
end $$;

-- Opening the confirmation link: Auth sets email_confirmed_at.
create function pg_temp.confirm(p_id uuid)
returns void language sql as $$
  update auth.users set email_confirmed_at = now() where id = p_id;
$$;

create function pg_temp.act_as(p_id uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000005a1', 'cust-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000005b1', 'cust-op@test.local', 'Oscar Operador', 'operator');

select pg_temp.sign_up('00000000-0000-0000-0000-0000000005c1', 'jose@test.local', 'email',
  '{"full_name":"José Pérez","phone":"+57 300 123 4567","data_consent":true}');
select pg_temp.sign_up('00000000-0000-0000-0000-0000000005c2', 'carla@test.local', 'email',
  '{"full_name":"Carla Cliente","data_consent":true}');
select pg_temp.confirm('00000000-0000-0000-0000-0000000005c2');

-- Structure --------------------------------------------------------------------------------------
select enum_has_labels('public', 'customer_origin', array['self_signup', 'google', 'counter'],
  'customer_origin: own sign-up, Google or counter');
select enum_has_labels('public', 'customer_status', array['registered', 'walk_in', 'disabled'],
  'customer_status: with account, without account, disabled');
select has_table('public', 'customers', 'customers table exists');
select col_is_pk('public', 'customers', 'id', 'id is the primary key');
select col_is_unique('public', 'customers', 'user_id', 'an account belongs to at most one customer');
select ok(
  (select bool_and(attgenerated = 's') from pg_attribute
   where attrelid = 'public.customers'::regclass and attname in ('status', 'search_text')),
  'status and search_text are generated columns (one source of truth)'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.customers'::regclass),
  'RLS is enabled on customers'
);
select policies_are('public', 'customers',
  array['customers_select_staff_or_own', 'customers_insert_staff', 'customers_update_staff_or_own'],
  'customers has exactly the select, insert and update policies (no delete, RN-08)');
select ok(not has_table_privilege('anon', 'public.customers', 'SELECT'), 'anon cannot read customers');
select ok(not has_table_privilege('authenticated', 'public.customers', 'DELETE'), 'customers are never deleted through the API (RN-08)');
select ok(
  has_column_privilege('authenticated', 'public.customers', 'full_name', 'INSERT')
  and not has_column_privilege('authenticated', 'public.customers', 'user_id', 'INSERT')
  and not has_column_privilege('authenticated', 'public.customers', 'origin', 'INSERT'),
  'the API inserts only name, email and phone (origin and account are set by the database)'
);
select ok(
  has_column_privilege('authenticated', 'public.customers', 'disabled_at', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.customers', 'user_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.customers', 'avatar_url', 'UPDATE'),
  'the API updates only name, email, phone and disabled_at (subject to RLS and the guard)'
);

-- Data rules ------------------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.customers (full_name, origin, registered_by)
     values ('No Contact', 'counter', '00000000-0000-0000-0000-0000000005b1') $$,
  '23514', null,
  'RN-02: a customer needs at least an email or a phone'
);
insert into public.customers (full_name, phone, email, origin, registered_by)
values ('Walter Walkin', '+57 (310) 555-12-34', 'Walter@Test.Local', 'counter', '00000000-0000-0000-0000-0000000005b1');
select results_eq(
  $$ select phone, email, status::text from public.customers where full_name = 'Walter Walkin' $$,
  $$ values ('3105551234', 'walter@test.local', 'walk_in') $$,
  'RN-03/RN-01: the phone is stored as 10 digits, the email in lowercase, and a counter customer is "walk_in"'
);
select throws_ok(
  $$ insert into public.customers (full_name, phone, origin, registered_by)
     values ('Bad Phone', '2015551234', 'counter', '00000000-0000-0000-0000-0000000005b1') $$,
  '23514', null,
  'RN-03: a phone that is not a Colombian mobile (10 digits starting with 3) is rejected'
);

-- Sign-up → customer on confirmation (CA-19, RN-07, RF-07) -----------------------------------
select is_empty(
  $$ select 1 from public.customers where email = 'jose@test.local' $$,
  'CA-19: an unconfirmed sign-up is not a customer yet'
);
select pg_temp.confirm('00000000-0000-0000-0000-0000000005c1');
select results_eq(
  $$ select user_id, full_name, phone, origin::text, status::text, consent_at
     from public.customers where email = 'jose@test.local' $$,
  $$ values ('00000000-0000-0000-0000-0000000005c1'::uuid, 'José Pérez', '3001234567', 'self_signup',
             'registered', '2026-11-01 10:00:00+00'::timestamptz) $$,
  'confirming the email creates the customer: name, normalised phone, origin, status and the sign-up date as consent date'
);
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000005c1';
select results_eq(
  $$ select count(*)::int from public.customers where email = 'jose@test.local' $$,
  $$ values (1) $$,
  'a later update of the confirmation never duplicates the customer'
);
select is_empty(
  $$ select 1 from public.customers where email in ('cust-admin@test.local', 'cust-op@test.local') $$,
  'CA-11: staff never appear as customers'
);

-- Search text (CA-16) ----------------------------------------------------------------------------
select results_eq(
  $$ select full_name from public.customers where search_text like '%' || 'jose perez' || '%' $$,
  $$ values ('José Pérez') $$,
  'CA-16: the search text ignores case and accents ("jose perez" finds "José Pérez")'
);
select results_eq(
  $$ select full_name from public.customers where search_text like '%5551234%' $$,
  $$ values ('Walter Walkin') $$,
  'CA-16: the search text includes the phone'
);

-- current_account() and is_staff() --------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005c1');
select results_eq(
  $$ select kind, role::text, status from public.current_account() $$,
  $$ values ('customer', null::text, 'active') $$,
  'current_account() for a customer session'
);
select ok(not public.is_staff(), 'a customer is not staff');

select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1');
select results_eq(
  $$ select kind, role::text, status from public.current_account() $$,
  $$ values ('staff', 'operator', 'active') $$,
  'current_account() for a staff session'
);
select ok(public.is_staff(), 'an active operator is staff');

-- RLS: staff ------------------------------------------------------------------------------------
select results_eq(
  $$ select full_name from public.customers where email in ('jose@test.local', 'carla@test.local', 'walter@test.local')
     order by full_name $$,
  $$ values ('Carla Cliente'), ('José Pérez'), ('Walter Walkin') $$,
  'an operator reads every customer'
);
select results_eq(
  $$ select status::text, total::int from public.customer_status_counts()
     where status in ('registered', 'walk_in') order by status $$,
  $$ select status::text, count(*)::int from public.customers
     where status in ('registered', 'walk_in') group by status order by status $$,
  'customer_status_counts() returns the totals per status that staff can see'
);

select results_eq(
  $$ select public.customer_registrar_name(id) from public.customers where full_name = 'Walter Walkin' $$,
  $$ values ('Oscar Operador') $$,
  'CA-18: staff see who registered a counter customer'
);

-- RLS: the customer (CA-10, CA-11, CA-13, CA-14) ---------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000005c1');
select results_eq(
  $$ select full_name from public.customers $$,
  $$ values ('José Pérez') $$,
  'CA-10: a customer only reads their own row'
);
select is_empty($$ select 1 from public.profiles $$, 'CA-10: a customer cannot read staff profiles');
select results_eq(
  $$ update public.customers set full_name = 'José A. Pérez', phone = '311 222 3344'
     where user_id = '00000000-0000-0000-0000-0000000005c1' returning full_name, phone $$,
  $$ values ('José A. Pérez', '3112223344') $$,
  'CA-13: a customer updates their own name and phone'
);
select throws_ok(
  $$ update public.customers set email = 'other@test.local' where user_id = '00000000-0000-0000-0000-0000000005c1' $$,
  '42501', null,
  'CA-14 / RN-10: a customer cannot change their email'
);
select throws_ok(
  $$ update public.customers set disabled_at = now() where user_id = '00000000-0000-0000-0000-0000000005c1' $$,
  '42501', null,
  'CA-10: a customer cannot change their own status'
);
select is_empty(
  $$ update public.customers set full_name = 'Hacked' where email = 'carla@test.local' returning 1 $$,
  'CA-10: a customer cannot update another customer'
);
select is(
  (select public.customer_registrar_name(id) from public.customers where email = 'walter@test.local'),
  null,
  'a customer never learns the name of a staff member'
);
select throws_ok(
  $$ insert into public.customers (full_name, phone) values ('Fake', '3000000000') $$,
  '42501', null,
  'CA-10: a customer cannot create customers'
);
reset role;

select * from finish();
rollback;
