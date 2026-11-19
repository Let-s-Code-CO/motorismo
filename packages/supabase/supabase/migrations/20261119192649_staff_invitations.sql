-- Spec 004 — staff only come from an admin's invitation.
--
-- Public sign-up is now open (customers register themselves), so raw_user_meta_data is written by
-- anyone (`signUp({ options: { data: { role: 'admin' } } })`) and can no longer decide who is
-- staff. A pending row in public.staff_invitations, which only an active admin can create, is now
-- the only way to become staff; every other new auth user is a customer sign-up (RN-11). The
-- customer row itself is created when the email is confirmed (see the customers migration).
--
-- seeds: supabase/seeds/01_users.sql creates the staff invitations before the staff users.

-- Helpers outside the API ------------------------------------------------------------------------
-- The private schema is not exposed by PostgREST: functions here can be used by triggers, RLS and
-- generated columns without becoming callable from the browser.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- RN-03: Colombian mobile, 10 digits starting with 3. Accepts spaces, hyphens, dots, parentheses
-- and the +57 / 57 prefix; returns the 10 digits, or null when it is not a valid mobile.
create function private.normalize_mobile(p_phone text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  with cleaned as (
    select regexp_replace(coalesce(p_phone, ''), '[[:space:]().-]', '', 'g') as digits
  ), unprefixed as (
    select case
      when digits ~ '^\+57' then substr(digits, 4)
      when digits ~ '^57[0-9]{10}$' then substr(digits, 3)
      else digits
    end as digits
    from cleaned
  )
  select case when digits ~ '^3[0-9]{9}$' then digits end from unprefixed;
$$;

revoke all on function private.normalize_mobile(text) from public;
grant execute on function private.normalize_mobile(text) to authenticated, service_role;

-- Table ------------------------------------------------------------------------------------------
create table public.staff_invitations (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  role public.user_role not null,
  -- null only for the first admin of an environment (admin:bootstrap).
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.staff_invitations is
  'Pending staff invitations. The only way to become staff: consumed when the auth user is created (spec 004, RN-11).';

create index staff_invitations_invited_by_idx on public.staff_invitations (invited_by);

-- RLS and privileges -----------------------------------------------------------------------------
alter table public.staff_invitations enable row level security;

create policy staff_invitations_select_admin
  on public.staff_invitations
  for select
  to authenticated
  using ((select public.is_admin()));

create policy staff_invitations_insert_admin
  on public.staff_invitations
  for insert
  to authenticated
  with check ((select public.is_admin()) and invited_by = (select auth.uid()));

-- Withdrawn when sending the invitation email fails.
create policy staff_invitations_delete_admin
  on public.staff_invitations
  for delete
  to authenticated
  using ((select public.is_admin()));

revoke all on table public.staff_invitations from anon, authenticated;
grant select, insert, delete on table public.staff_invitations to authenticated;

-- New auth users ---------------------------------------------------------------------------------
-- Replaces the spec 002 version, which trusted the role in raw_user_meta_data.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.staff_invitations;
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_full_name text;
  v_phone text;
begin
  select * into v_invitation from public.staff_invitations where email = lower(new.email);

  if found then
    insert into public.profiles (id, full_name, email, role, invited_by)
    values (new.id, v_invitation.full_name, lower(new.email), v_invitation.role, v_invitation.invited_by);

    delete from public.staff_invitations where email = v_invitation.email;
    return new;
  end if;

  -- Not invited: a customer sign-up (RN-11). Validated now; the customer row is created when the
  -- email is confirmed (Google arrives already confirmed).
  v_full_name := btrim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name', ''));
  if v_full_name = '' then
    raise exception 'full_name is required to create an account'
      using errcode = 'check_violation', hint = 'account_full_name_required';
  end if;

  -- RN-04: the sign-up form requires the consent; Google shows the notice next to its button.
  if v_provider = 'email' and coalesce(v_meta ->> 'data_consent', '') <> 'true' then
    raise exception 'the data-processing consent is required to sign up'
      using errcode = 'check_violation', hint = 'customer_consent_required';
  end if;

  v_phone := nullif(btrim(coalesce(v_meta ->> 'phone', '')), '');
  if v_phone is not null and private.normalize_mobile(v_phone) is null then
    raise exception 'invalid mobile phone: %', v_phone
      using errcode = 'check_violation', hint = 'customer_phone_invalid';
  end if;

  return new;
end;
$$;
