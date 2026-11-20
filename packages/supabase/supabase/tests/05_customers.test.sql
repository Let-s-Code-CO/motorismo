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

select plan(56);

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

-- Part B ==========================================================================================

-- Google (CA-20, CA-21, CA-23) ------------------------------------------------------------------
-- Google arrives already confirmed: the customer exists right away, with origin "google".
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                        raw_user_meta_data, email_confirmed_at, created_at)
values ('00000000-0000-0000-0000-0000000005d1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'gabi@test.local', '', '{"provider":"google","providers":["google"]}',
        '{"name":"Gabi Google","full_name":"Gabi Google"}', now(), '2026-11-02 09:00:00+00');
select results_eq(
  $$ select full_name, origin::text, status::text, consent_at from public.customers
     where user_id = '00000000-0000-0000-0000-0000000005d1' $$,
  $$ values ('Gabi Google', 'google', 'registered', '2026-11-02 09:00:00+00'::timestamptz) $$,
  'CA-20: a Google sign-up is a customer at once, with origin Google and the consent date'
);
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('gabi-google', '00000000-0000-0000-0000-0000000005d1',
        '{"email":"gabi@test.local","picture":"https://lh3.googleusercontent.com/a/gabi-1"}', 'google');
select is(
  (select avatar_url from public.customers where user_id = '00000000-0000-0000-0000-0000000005d1'),
  'https://lh3.googleusercontent.com/a/gabi-1',
  'CA-20: the customer gets the Google photo'
);
update auth.identities
set identity_data = '{"email":"gabi@test.local","picture":"https://lh3.googleusercontent.com/a/gabi-2"}'
where provider_id = 'gabi-google';
select is(
  (select avatar_url from public.customers where user_id = '00000000-0000-0000-0000-0000000005d1'),
  'https://lh3.googleusercontent.com/a/gabi-2',
  'CA-20: the photo is refreshed on every Google sign-in'
);

-- CA-21: an unconfirmed email account confirmed through Google stays ONE customer.
select pg_temp.sign_up('00000000-0000-0000-0000-0000000005d2', 'luis@test.local', 'email',
  '{"full_name":"Luis Link","data_consent":true}');
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('luis-google', '00000000-0000-0000-0000-0000000005d2',
        '{"email":"luis@test.local","avatar_url":"https://lh3.googleusercontent.com/a/luis"}', 'google');
select pg_temp.confirm('00000000-0000-0000-0000-0000000005d2');
select results_eq(
  $$ select count(*)::int from public.customers where email = 'luis@test.local' $$,
  $$ values (1) $$,
  'CA-21: an existing account that is confirmed by signing in with Google is one customer'
);

-- CA-23: staff signing in with Google never get a customer record.
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('op-google', '00000000-0000-0000-0000-0000000005b1',
        '{"email":"cust-op@test.local","picture":"https://lh3.googleusercontent.com/a/op"}', 'google');
update auth.users set email_confirmed_at = now() where id = '00000000-0000-0000-0000-0000000005b1';
select is_empty(
  $$ select 1 from public.customers where email = 'cust-op@test.local' $$,
  'CA-23: a staff member who signs in with Google gets no customer record'
);

-- Counter registration by staff (CA-24, CA-26, CA-27) --------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1');
select lives_ok(
  $$ insert into public.customers (full_name, phone) values ('Marta Mostrador', '312 000 1111') $$,
  'CA-24: an operator registers a customer at the counter with a name and a phone only'
);
reset role;
select results_eq(
  $$ select origin::text, registered_by, user_id, status::text, phone from public.customers
     where full_name = 'Marta Mostrador' $$,
  $$ values ('counter', '00000000-0000-0000-0000-0000000005b1'::uuid, null::uuid, 'walk_in', '3120001111') $$,
  'CA-24: the database records the counter origin and who registered the customer, without account'
);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000005b1');
select throws_ok(
  $$ insert into public.customers (full_name, email) values ('Copia', 'CUST-ADMIN@test.local') $$,
  '23505', null,
  'CA-26 / RN-01: an email of a staff member cannot be used for a customer'
);
select throws_ok(
  $$ insert into public.customers (full_name, email) values ('Copia', 'Carla@Test.Local') $$,
  '23505', null,
  'CA-26 / RN-01: an email of another customer cannot be reused, whatever its case'
);
select results_eq(
  $$ update public.customers set email = 'marta@test.local', full_name = 'Marta M.'
     where full_name = 'Marta Mostrador' returning email, full_name $$,
  $$ values ('marta@test.local', 'Marta M.') $$,
  'CA-27: staff edit a counter customer, email included (it has no account)'
);
select throws_ok(
  $$ update public.customers set email = 'walter@test.local' where email = 'marta@test.local' $$,
  '23505', null,
  'CA-26: editing a customer to an email already in use is rejected'
);
select throws_ok(
  $$ update public.customers set email = 'nuevo@test.local' where email = 'carla@test.local' $$,
  '42501', null,
  'CA-27 / RN-10: the email of a customer with an account cannot be changed, not even by staff'
);
select lives_ok(
  $$ update public.customers set phone = '3001110000' where email = 'carla@test.local' $$,
  'CA-27: staff can still change the phone of a customer with an account'
);

-- Enabling and disabling (CA-29, CA-30, CA-31, RN-09) -------------------------------------------
select lives_ok(
  $$ update public.customers set disabled_at = now() where email = 'carla@test.local' $$,
  'CA-29 / RN-09: an operator disables a customer too'
);
select lives_ok(
  $$ update public.customers set disabled_at = null where email = 'carla@test.local' $$,
  'CA-30 / RN-09: an operator reactivates a customer too'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000005c2');
select throws_ok(
  $$ update public.customers set disabled_at = now() where email = 'carla@test.local' $$,
  '42501', null,
  'CA-31 / RN-09: a customer cannot disable an account, not even their own'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1');
update public.customers set disabled_at = now() where email in ('carla@test.local', 'marta@test.local');
select results_eq(
  $$ select status::text from public.customers where email in ('carla@test.local', 'marta@test.local')
     order by email $$,
  $$ values ('disabled'), ('disabled') $$,
  'CA-29: an admin disables customers, with or without account'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000005c2');
select results_eq(
  $$ select kind, status from public.current_account() $$,
  $$ values ('customer', 'disabled') $$,
  'CA-29: the session of a disabled customer is reported as disabled (the proxy signs it out)'
);
select pg_temp.act_as('00000000-0000-0000-0000-0000000005a1');
update public.customers set disabled_at = null where email in ('carla@test.local', 'marta@test.local');
select results_eq(
  $$ select email, status::text from public.customers where email in ('carla@test.local', 'marta@test.local')
     order by email $$,
  $$ values ('carla@test.local', 'registered'), ('marta@test.local', 'walk_in') $$,
  'CA-30: reactivating returns a customer to "with account" or "without account"'
);
reset role;

-- Linking a counter record on sign-up (CA-28) ------------------------------------------------------
select pg_temp.sign_up('00000000-0000-0000-0000-0000000005d3', 'Marta@Test.Local', 'email',
  '{"full_name":"Marta Registrada","phone":"3155550000","data_consent":true}');
-- The counter record had no phone in this case: the one given at sign-up fills it in.
update public.customers set phone = null where email = 'marta@test.local';
select pg_temp.confirm('00000000-0000-0000-0000-0000000005d3');
select results_eq(
  $$ select count(*)::int, min(full_name), min(phone), bool_and(user_id = '00000000-0000-0000-0000-0000000005d3'),
            min(status::text)
     from public.customers where email = 'marta@test.local' $$,
  $$ values (1, 'Marta M.', '3155550000', true, 'registered') $$,
  'CA-28: the counter record becomes the account (one row, its data kept, the missing phone added)'
);

select * from finish();
rollback;
