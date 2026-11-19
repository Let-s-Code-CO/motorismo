-- profiles — business rules enforced in Postgres (spec 002).
--
-- Guards:
--   * on_auth_user_created: an auth user with a pending staff invitation gets a profile built from
--     that invitation (full_name, role, invited_by), starting as "invited" (spec 004: never from
--     the sign-up metadata, see 04_staff_invitations); an invitation with an unknown role cannot
--     exist, and a user without invitation nor name is rejected;
--   * an admin changes other users' role/status, effective on their next request (CA-18);
--   * nobody — not even an admin — changes their own role or status through the API (CA-10);
--   * at least one active admin always remains, even for service-role updates (CA-21, RN-03);
--   * a disabled admin loses admin powers immediately (is_admin() = false);
--   * activation never comes from the user: a password stored in Auth does NOT activate by itself
--     (Auth writes a random one when the invitation link is verified); the app activates with the
--     service role after the person sets their own password (CA-14); linking a non-email identity
--     such as Google activates (CA-26);
--   * RN-08: "active" requires having accepted the invitation once (activated_at, set on the
--     first activation and immutable); a disabled user who never accepted goes back to "invited"
--     when reactivated (CA-29), one who did accept never does;
--   * identity columns are immutable.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

create function pg_temp.new_user(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role, invited_by)
  values (p_email, p_name, p_role::public.user_role, '00000000-0000-0000-0000-0000000000a1');
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{}');
end $$;

-- The first admin is invited by nobody.
insert into public.staff_invitations (email, full_name, role) values ('admin@test.local', 'Ana Admin', 'admin');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'admin@test.local', '', '{}');
update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000a1';

-- State-independent: demote any other admin (e.g. local seeds) so a1 is the only active admin.
-- Rolled back with the rest of the file.
update public.profiles set role = 'operator'
where role = 'admin' and id <> '00000000-0000-0000-0000-0000000000a1';

select pg_temp.new_user('00000000-0000-0000-0000-0000000000b1', 'op1@test.local', 'Oscar Operador', 'operator');

-- Profile creation from the invitation -------------------------------------------------------
select results_eq(
  $$ select full_name, email, role::text, status::text, invited_by
     from public.profiles where id = '00000000-0000-0000-0000-0000000000b1' $$,
  $$ values ('Oscar Operador', 'op1@test.local', 'operator', 'invited',
             '00000000-0000-0000-0000-0000000000a1'::uuid) $$,
  'an invited user gets a profile with the invitation name, role and inviter, in status invited'
);

select throws_ok(
  $$ insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
     values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
             'authenticated', 'noname@test.local', '', '{"data_consent":true}') $$,
  '23514', null,
  'creating an auth user without invitation nor full_name is rejected'
);

select throws_ok(
  $$ insert into public.staff_invitations (email, full_name, role)
     values ('boss@test.local', 'Boss', 'boss') $$,
  '22P02', null,
  'a staff invitation with an unknown role is rejected'
);

-- CA-14 / CA-26: activation ---------------------------------------------------------------------
-- Auth writes a random password when the invitation link is verified: that must not activate.
update auth.users set encrypted_password = 'hash-written-by-auth-on-verify'
where id = '00000000-0000-0000-0000-0000000000b1';
select is(
  (select status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'invited',
  'a password stored in Auth does not activate by itself (opening the link is not enough)'
);

-- What the setPassword action does after the person chose their password (CA-14).
set local role service_role;
update public.profiles set status = 'active'
where id = '00000000-0000-0000-0000-0000000000b1' and status = 'invited';
reset role;
select is(
  (select status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'active',
  'the service role activates an invited user once they set their own password (CA-14)'
);

select pg_temp.new_user('00000000-0000-0000-0000-0000000000c1', 'google@test.local', 'Gina Google', 'operator');
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('google-sub-1', '00000000-0000-0000-0000-0000000000c1', '{"email":"google@test.local"}', 'email');
select is(
  (select status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'invited',
  'an email identity alone does not activate the user (it is created with the invitation)'
);
insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('google-sub-2', '00000000-0000-0000-0000-0000000000c1', '{"email":"google@test.local"}', 'google');
select is(
  (select status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  'active',
  'linking a Google identity activates an invited user (CA-26)'
);

-- CA-18: an admin changes another user's role and status ----------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'an admin promotes an operator'
);
select is(
  (select role::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  'admin',
  'the promotion is stored, so the next request of that user sees admin permissions (CA-18)'
);

-- CA-10: nobody changes their own role or status, not even an admin.
select throws_ok(
  $$ update public.profiles set role = 'operator' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'an admin cannot change their own role'
);
select throws_ok(
  $$ update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '42501', null,
  'an admin cannot disable themselves'
);

-- With two active admins (a1 and b1), one may demote the other.
select lives_ok(
  $$ update public.profiles set role = 'operator' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'an admin may demote another admin while another active admin remains'
);

-- No transition back to invited; identity columns are immutable.
select throws_ok(
  $$ update public.profiles set status = 'invited' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null,
  'an active user cannot be moved back to invited'
);

-- A disabled admin loses admin powers on the very next query.
reset role;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000b1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(public.is_admin(), false, 'a disabled admin is not an admin');
select is(public.current_profile_role(), null, 'a disabled user has no effective role');
select results_eq(
  $$ select id from public.profiles $$,
  $$ values ('00000000-0000-0000-0000-0000000000b1'::uuid) $$,
  'a disabled admin only sees their own profile (to learn they are disabled)'
);

-- An active operator has the operator role and is not admin.
reset role;
update public.profiles set status = 'active', role = 'operator' where id = '00000000-0000-0000-0000-0000000000b1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is(public.current_profile_role()::text, 'operator', 'an active operator has the operator role');
select is(public.is_admin(), false, 'an operator is not an admin');
reset role;

-- CA-21 / RN-03: the last active admin (a1) can never be demoted or disabled ------------------
select throws_ok(
  $$ update public.profiles set role = 'operator' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'demoting the last active admin is rejected, even with service-level access'
);
select throws_ok(
  $$ update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000a1' $$,
  '23514', null,
  'disabling the last active admin is rejected, even with service-level access'
);
select throws_ok(
  $$ update public.profiles set email = 'other@test.local' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null,
  'email is immutable (it mirrors the Auth identity)'
);
select throws_ok(
  $$ update public.profiles set invited_by = null where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null,
  'invited_by is immutable'
);
select lives_ok(
  $$ update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  'disabling an operator is allowed (it never affects the admin count)'
);

-- RN-08 / CA-29: activated_at --------------------------------------------------------------------
select isnt(
  (select activated_at from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'),
  null,
  'the first activation (password set) records activated_at'
);
select isnt(
  (select activated_at from public.profiles where id = '00000000-0000-0000-0000-0000000000c1'),
  null,
  'activation by linking Google records activated_at'
);
-- b1 accepted its invitation and is now disabled.
select throws_ok(
  $$ update public.profiles set status = 'invited' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null,
  'a disabled user who had accepted the invitation cannot go back to invited'
);
select throws_ok(
  $$ update public.profiles set activated_at = null where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null,
  'activated_at is immutable once set'
);

select pg_temp.new_user('00000000-0000-0000-0000-0000000000c2', 'never@test.local', 'Nunca Aceptó', 'operator');
select lives_ok(
  $$ update public.profiles set status = 'disabled' where id = '00000000-0000-0000-0000-0000000000c2' $$,
  'an invited user who never accepted can be disabled'
);
select throws_ok(
  $$ update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000c2' $$,
  '23514', null,
  'a user who never accepted the invitation cannot become active by reactivation (RN-08)'
);
select lives_ok(
  $$ update public.profiles set status = 'invited' where id = '00000000-0000-0000-0000-0000000000c2' $$,
  'reactivating a user who never accepted returns them to invited (CA-29)'
);

select * from finish();
rollback;
