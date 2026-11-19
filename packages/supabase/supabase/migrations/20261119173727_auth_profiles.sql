-- Spec 002 — Authentication and roles.
--
-- `public.profiles` is the source of truth for who may do what: name, role and status of every
-- app user. Auth (auth.users / auth.identities) owns credentials and sessions; this table owns
-- authorization. Enforcement lives here (RLS + triggers), never only in the UI.
--
-- seeds: supabase/seeds/01_users.sql creates the local admin / operator / disabled users.

-- Types ------------------------------------------------------------------------------------------
create type public.user_role as enum ('operator', 'admin');
create type public.user_status as enum ('invited', 'active', 'disabled');

-- Table ------------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict, -- RN-05: never deleted
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text not null,
  role public.user_role not null default 'operator',
  status public.user_status not null default 'invited',
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'App users: name, role and status. Source of truth for authorization (spec 002).';
comment on column public.profiles.email is 'Mirror of auth.users.email (lowercase). Immutable.';
comment on column public.profiles.status is
  'invited → active (first password or linked OAuth identity); active ↔ disabled (admin).';

-- RN-02: one user per email, case-insensitive.
create unique index profiles_email_lower_key on public.profiles (lower(email));
-- Index the self-referencing FK (Postgres does not index FKs automatically).
create index profiles_invited_by_idx on public.profiles (invited_by);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Authorization helpers --------------------------------------------------------------------------
-- SECURITY DEFINER so policies can read profiles without recursing into their own RLS.
-- A user only has an effective role while their status is "active".
create function public.current_profile_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.status = 'active';
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_profile_role() = 'admin', false);
$$;

revoke execute on function public.current_profile_role() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_profile_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

-- RLS and privileges -----------------------------------------------------------------------------
alter table public.profiles enable row level security;

-- Own row (so a disabled user can learn their status) or every row for an admin.
create policy profiles_select_own_or_admin
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_admin
  on public.profiles
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Supabase grants ALL on new public tables to anon/authenticated by default: narrow it down.
-- No insert/delete through the API: profiles are created by on_auth_user_created and never deleted.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (role, status) on table public.profiles to authenticated;

-- Profile creation from the invitation -----------------------------------------------------------
-- Public sign-up is disabled, so only the Auth admin API (secret key) creates users and the
-- invitation metadata is trusted at insert time. A missing name or unknown role aborts the
-- insert: a user can never exist without a valid profile.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text := btrim(coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'operator');
  v_invited_by uuid := nullif(new.raw_user_meta_data ->> 'invited_by', '')::uuid;
begin
  if v_full_name = '' then
    raise exception 'full_name is required to create a profile'
      using errcode = 'check_violation', hint = 'profile_full_name_required';
  end if;

  if v_role not in ('operator', 'admin') then
    raise exception 'invalid role: %', v_role
      using errcode = 'invalid_parameter_value', hint = 'profile_invalid_role';
  end if;

  insert into public.profiles (id, full_name, email, role, invited_by)
  values (new.id, v_full_name, lower(new.email), v_role::public.user_role, v_invited_by);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Activation (CA-14, CA-26) ----------------------------------------------------------------------
-- Never by the user through the API (CA-10). Two paths:
--   * password: the app's setPassword action, with the secret key, AFTER Auth stored the password
--     the person chose. Not a trigger on auth.users.encrypted_password: Auth already writes a
--     random password when the invitation link is verified, which would activate too early;
--   * OAuth (e.g. Google): linking a non-email identity, below.
create function public.activate_profile_on_identity_linked()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The "email" identity is created with the invitation itself; only other providers count.
  if new.provider <> 'email' then
    update public.profiles set status = 'active' where id = new.user_id and status = 'invited';
  end if;
  return new;
end;
$$;

create trigger on_auth_identity_linked
  after insert on auth.identities
  for each row execute function public.activate_profile_on_identity_linked();

-- Guard rules (CA-10, CA-21, RN-03) --------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user tells API callers (authenticated) apart from the
-- activation triggers above (which run as the function owner).
create function public.profiles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id <> old.id
     or new.email <> old.email
     or new.invited_by is distinct from old.invited_by
     or new.created_at <> old.created_at then
    raise exception 'profile identity columns are immutable'
      using errcode = 'check_violation', hint = 'profile_immutable_column';
  end if;

  if current_user in ('authenticated', 'anon')
     and old.id = (select auth.uid())
     and (new.role <> old.role or new.status <> old.status) then
    raise exception 'users cannot change their own role or status'
      using errcode = 'insufficient_privilege', hint = 'profile_self_change';
  end if;

  if new.status = 'invited' and old.status <> 'invited' then
    raise exception 'a user cannot go back to invited'
      using errcode = 'check_violation', hint = 'profile_invalid_status_transition';
  end if;

  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active')
     and not exists (
       select 1
       from public.profiles p
       where p.id <> old.id
         and p.role = 'admin'
         and p.status = 'active'
     ) then
    raise exception 'at least one active admin must remain'
      using errcode = 'check_violation', hint = 'profile_last_admin';
  end if;

  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();
