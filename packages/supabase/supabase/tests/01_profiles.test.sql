-- profiles — structure and access control (spec 002).
--
-- `public.profiles` holds the name, role and status of every app user and is the single source
-- of truth for permissions. This file guards:
--   * the shape of the table (RF-02) and that users are never deleted (RN-05: FK on delete restrict);
--   * case-insensitive unique emails (RN-02);
--   * RLS + privileges: anon gets nothing; authenticated may only SELECT, and UPDATE only role/status;
--     nobody inserts or deletes through the API (profiles are created by a trigger on auth.users);
--   * an operator only sees their own row and cannot update any row, even with direct requests
--     that bypass the UI (CA-09); an admin sees every row.
-- Behavioural rules (triggers, last-admin guard, activation) live in 02_profiles_rules.test.sql.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

-- Fixtures: staff are created the way the app does it (spec 004): a pending invitation, then the
-- auth user (insert into auth.users); on_auth_user_created builds the profile from the invitation.
create function pg_temp.new_user(p_id uuid, p_email text, p_name text, p_role text, p_status text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role)
  values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{}');
  update public.profiles set status = p_status::public.user_status where id = p_id;
end $$;

select pg_temp.new_user('00000000-0000-0000-0000-0000000000a1', 'admin@test.local', 'Ana Admin', 'admin', 'active');
select pg_temp.new_user('00000000-0000-0000-0000-0000000000b1', 'op1@test.local', 'Oscar Operador', 'operator', 'active');
select pg_temp.new_user('00000000-0000-0000-0000-0000000000b2', 'op2@test.local', 'Olga Operadora', 'operator', 'active');

-- Structure -----------------------------------------------------------------------------------
select enum_has_labels('public', 'user_role', array['operator', 'admin'], 'user_role has operator and admin');
select enum_has_labels('public', 'user_status', array['invited', 'active', 'disabled'], 'user_status has the three states');
select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'id is the primary key');
select col_type_is('public', 'profiles', 'role', 'user_role', 'role uses the user_role enum');
select col_type_is('public', 'profiles', 'status', 'user_status', 'status uses the user_status enum');
select col_default_is('public', 'profiles', 'role', 'operator'::public.user_role, 'new users are operators by default');
select col_default_is('public', 'profiles', 'status', 'invited'::public.user_status, 'new users start as invited');
select col_not_null('public', 'profiles', 'full_name', 'full_name is required');
select col_not_null('public', 'profiles', 'email', 'email is required');

-- RN-05: an auth user with a profile cannot be deleted (accounts are disabled, never deleted).
select throws_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-0000000000b2' $$,
  '23503', null,
  'deleting an auth user that has a profile is rejected (users are disabled, not deleted)'
);

-- RN-02: emails are unique regardless of case.
select throws_ok(
  $$ insert into public.profiles (id, full_name, email)
     values ('00000000-0000-0000-0000-0000000000b2', 'Dup', 'OP1@TEST.LOCAL') $$,
  '23505', null,
  'a second profile with the same email in another case is rejected'
);

-- RLS and privileges ----------------------------------------------------------------------------
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles'
);
select policies_are('public', 'profiles',
  array['profiles_select_own_or_admin', 'profiles_update_admin'],
  'profiles has exactly the select and update policies');
select ok(not has_table_privilege('anon', 'public.profiles', 'SELECT'), 'anon cannot read profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'INSERT'), 'authenticated cannot insert profiles');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'DELETE'), 'authenticated cannot delete profiles');
select ok(has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'), 'authenticated may update role (subject to RLS)');
select ok(has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE'), 'authenticated may update status (subject to RLS)');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'), 'authenticated cannot update email');
select ok(not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE'), 'authenticated cannot update full_name');

-- CA-09: an operator acting directly against the API ------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'an operator only sees their own profile'
);

with changed as (
  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b2' returning 1
)
select is(count(*)::int, 0, 'an operator cannot promote another user (no row is updated)') from changed;

with changed as (
  update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1' returning 1
)
select is(count(*)::int, 0, 'an operator cannot promote themselves (no row is updated)') from changed;

-- An admin sees everyone.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
-- Filtered to this file's fixtures so local seed users do not change the count.
select is(
  (select count(*)::int from public.profiles where email like '%@test.local'),
  3,
  'an admin sees every profile (1 admin + 2 operators = 3)'
);

-- anon sees nothing at all.
reset role;
set local role anon;
select throws_ok(
  $$ select 1 from public.profiles $$,
  '42501', null,
  'anon gets a permission error on profiles'
);
reset role;

select * from finish();
rollback;
