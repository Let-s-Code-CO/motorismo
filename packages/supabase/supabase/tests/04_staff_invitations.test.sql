-- staff_invitations — staff only come from an admin's invitation (spec 004).
--
-- With public sign-up open (customers register themselves), the sign-up metadata is written by
-- anyone, so it can never decide who is staff. This file guards:
--   * the shape of public.staff_invitations, its RLS and privileges: only an active admin creates
--     (as themselves) or withdraws invitations; anon gets nothing; nobody updates them;
--   * an auth user with a pending invitation becomes staff with the invitation's name, role and
--     inviter, and the invitation is consumed;
--   * RN-11: an auth user WITHOUT invitation never becomes staff, even if its metadata claims
--     role "admin" — it is a customer sign-up;
--   * customer sign-ups are validated when the account is created: a name is required, an
--     email sign-up needs the data-processing consent (RN-04; Google shows the notice instead)
--     and a phone, if given, must be a Colombian mobile (RN-03);
--   * RN-01: email_in_use() sees an email in any account, staff, pending invitation or customer,
--     case-insensitively, and is only callable with the service role.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

create function pg_temp.new_staff(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role) values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', '{}');
  update public.profiles set status = 'active' where id = p_id;
end $$;

-- A sign-up as Auth stores it: provider in raw_app_meta_data, form data in raw_user_meta_data.
create function pg_temp.sign_up(p_email text, p_provider text, p_meta jsonb)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)), p_meta);
  return v_id;
end $$;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000004a1', 'inv-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000004b1', 'inv-op@test.local', 'Oscar Operador', 'operator');

-- Structure, RLS and privileges ----------------------------------------------------------------
select has_table('public', 'staff_invitations', 'staff_invitations table exists');
select col_is_pk('public', 'staff_invitations', 'email', 'the email is the primary key (one pending invitation per email)');
select throws_ok(
  $$ insert into public.staff_invitations (email, full_name, role) values ('Mixed@Test.Local', 'Mixed', 'operator') $$,
  '23514', null,
  'invitation emails are stored in lowercase'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.staff_invitations'::regclass),
  'RLS is enabled on staff_invitations'
);
select policies_are('public', 'staff_invitations',
  array['staff_invitations_select_admin', 'staff_invitations_insert_admin', 'staff_invitations_delete_admin'],
  'staff_invitations has exactly the admin select, insert and delete policies');
select ok(not has_table_privilege('anon', 'public.staff_invitations', 'SELECT'), 'anon cannot read invitations');
select ok(not has_table_privilege('anon', 'public.staff_invitations', 'INSERT'), 'anon cannot create invitations');
select ok(not has_table_privilege('authenticated', 'public.staff_invitations', 'UPDATE'), 'nobody updates an invitation through the API');

-- Staff come from the invitation ----------------------------------------------------------------
insert into public.staff_invitations (email, full_name, role, invited_by)
values ('new-op@test.local', 'Nora Nueva', 'operator', '00000000-0000-0000-0000-0000000004a1');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'new-op@test.local', '', '{"full_name":"Ignored Name","role":"admin"}');

select results_eq(
  $$ select full_name, role::text, status::text, invited_by from public.profiles
     where id = '00000000-0000-0000-0000-0000000004c1' $$,
  $$ values ('Nora Nueva', 'operator', 'invited', '00000000-0000-0000-0000-0000000004a1'::uuid) $$,
  'an invited user gets the name, role and inviter of the invitation, never those of the metadata'
);
select is_empty(
  $$ select 1 from public.staff_invitations where email = 'new-op@test.local' $$,
  'the invitation is consumed when the user is created'
);

-- RN-11: without invitation, the metadata role is ignored (customer sign-up) -------------------
select is_empty(
  format($$ select 1 from public.profiles where id = %L $$,
         pg_temp.sign_up('wannabe@test.local', 'email',
                         '{"full_name":"Wanna Be","role":"admin","data_consent":true}')),
  'RN-11: a sign-up claiming role admin without invitation never becomes staff'
);

-- Customer sign-up validation --------------------------------------------------------------------
select throws_ok(
  $$ select pg_temp.sign_up('noconsent@test.local', 'email', '{"full_name":"No Consent"}') $$,
  '23514', null,
  'RN-04: an email sign-up without the data-processing consent is rejected'
);
select lives_ok(
  $$ select pg_temp.sign_up('google-user@test.local', 'google', '{"full_name":"Gabi Google"}') $$,
  'a Google sign-up needs no consent flag (the notice is shown next to the button, CA-20)'
);
select throws_ok(
  $$ select pg_temp.sign_up('badphone@test.local', 'email',
                            '{"full_name":"Bad Phone","data_consent":true,"phone":"12345"}') $$,
  '23514', null,
  'RN-03: a sign-up with a phone that is not a Colombian mobile is rejected'
);

-- Who may invite (RLS) --------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004b1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.staff_invitations (email, full_name, role, invited_by)
     values ('by-op@test.local', 'By Op', 'operator', '00000000-0000-0000-0000-0000000004b1') $$,
  '42501', null,
  'an operator cannot invite'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.staff_invitations (email, full_name, role, invited_by)
     values ('by-admin@test.local', 'By Admin', 'operator', '00000000-0000-0000-0000-0000000004a1') $$,
  'an active admin invites as themselves'
);
select throws_ok(
  $$ insert into public.staff_invitations (email, full_name, role, invited_by)
     values ('spoofed@test.local', 'Spoofed', 'admin', '00000000-0000-0000-0000-0000000004b1') $$,
  '42501', null,
  'an admin cannot sign an invitation as someone else'
);
select results_eq(
  $$ with deleted as (delete from public.staff_invitations where email = 'by-admin@test.local' returning 1)
     select count(*)::int from deleted $$,
  $$ values (1) $$,
  'an admin can withdraw a pending invitation (e.g. when sending the email fails)'
);
reset role;

-- RN-01: email_in_use ---------------------------------------------------------------------------
insert into public.staff_invitations (email, full_name, role) values ('pending@test.local', 'Pending', 'operator');
insert into public.customers (full_name, email, origin, registered_by)
values ('Walk In', 'walkin@test.local', 'counter', '00000000-0000-0000-0000-0000000004a1');

select ok(
  public.email_in_use('WANNABE@test.local') and public.email_in_use('INV-OP@test.local'),
  'email_in_use sees accounts (customer sign-ups and staff) regardless of case'
);
select ok(
  public.email_in_use('pending@test.local') and public.email_in_use('walkin@test.local'),
  'email_in_use sees pending invitations and customers without account'
);
select ok(not public.email_in_use('nobody@test.local'), 'email_in_use is false for an unknown email');
select ok(
  not has_function_privilege('authenticated', 'public.email_in_use(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.email_in_use(text)', 'EXECUTE'),
  'email_in_use is not callable from the browser (it would reveal registered emails, RN-06)'
);

select * from finish();
rollback;
