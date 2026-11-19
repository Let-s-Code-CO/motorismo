-- Spec 004 — customers, with or without an account.
--
-- A customer signs up (email + password once the email is confirmed, or Google) or is registered
-- by staff at the counter without an account (user_id null). Staff (operator, admin) read and
-- edit customers; a customer only reads and edits their own name and phone; only an admin
-- disables a customer. Enforcement lives here (RLS + guard trigger), never only in the UI.
--
-- seeds: supabase/seeds/02_customers.sql creates local customers of every kind.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent() is STABLE (its dictionary could change); generated columns and indexes need an
-- IMMUTABLE function, so this wrapper pins the dictionary.
create function private.immutable_unaccent(p_text text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, p_text);
$$;

revoke all on function private.immutable_unaccent(text) from public;
grant execute on function private.immutable_unaccent(text) to authenticated, service_role;

-- Types ------------------------------------------------------------------------------------------
create type public.customer_origin as enum ('self_signup', 'google', 'counter');
create type public.customer_status as enum ('registered', 'walk_in', 'disabled');

-- Table ------------------------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  -- The customer's account; null = registered at the counter, without account. Never deleted.
  user_id uuid unique references auth.users (id) on delete restrict,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  email text check (email = lower(btrim(email)) and email <> ''),
  phone text check (phone ~ '^3[0-9]{9}$'),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  -- Defaults to the counter: the only origin the API can create (the guard enforces it, CA-24).
  origin public.customer_origin not null default 'counter',
  registered_by uuid references public.profiles (id),
  -- RF-07: when the customer authorised the processing of their data; the channel is `origin`
  -- (and `registered_by` for the counter).
  consent_at timestamptz not null default now(),
  disabled_at timestamptz,
  status public.customer_status not null generated always as (
    case
      when disabled_at is not null then 'disabled'::public.customer_status
      when user_id is not null then 'registered'::public.customer_status
      else 'walk_in'::public.customer_status
    end
  ) stored,
  search_text text not null generated always as (
    lower(private.immutable_unaccent(full_name || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- RN-02: a counter customer needs an email or a phone; an account always has an email.
  constraint customers_contact_required check (email is not null or phone is not null),
  constraint customers_account_has_email check (user_id is null or email is not null),
  constraint customers_counter_has_registrar check (origin <> 'counter' or registered_by is not null)
);

comment on table public.customers is
  'Customers of the business, with account (sign-up or Google) or registered at the counter (spec 004).';
comment on column public.customers.status is
  'Generated: disabled if disabled_at; else registered (has an account) or walk_in (no account).';
comment on column public.customers.search_text is
  'Generated: lowercase, accent-free name + email + phone, for the staff search (CA-16).';

-- RN-01: one email, one person (case-insensitive). Staff emails are checked by the guard.
create unique index customers_email_lower_key on public.customers (lower(email));
create index customers_registered_by_idx on public.customers (registered_by);
create index customers_status_created_at_idx on public.customers (status, created_at desc);
create index customers_created_at_idx on public.customers (created_at desc);
create index customers_search_text_trgm_idx on public.customers using gin (search_text extensions.gin_trgm_ops);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- Authorization helpers --------------------------------------------------------------------------
-- Staff = an ACTIVE operator or admin.
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_profile_role() is not null;
$$;

revoke execute on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;

-- What the proxy needs on every request: staff or customer, and the status.
create function public.current_account()
returns table (kind text, role public.user_role, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'staff', p.role, p.status::text
  from public.profiles p
  where p.id = (select auth.uid())
  union all
  select 'customer', null, case when c.disabled_at is null then 'active' else 'disabled' end
  from public.customers c
  where c.user_id = (select auth.uid())
  limit 1;
$$;

revoke execute on function public.current_account() from public, anon;
grant execute on function public.current_account() to authenticated, service_role;

-- RN-01: is this email taken by an account, staff, a pending invitation or a customer? Only for
-- the server (it would reveal which emails are registered, RN-06).
create function public.email_in_use(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with e as (select lower(btrim(p_email)) as email)
  select exists (select 1 from auth.users u, e where lower(u.email) = e.email)
      or exists (select 1 from public.profiles p, e where lower(p.email) = e.email)
      or exists (select 1 from public.staff_invitations i, e where i.email = e.email)
      or exists (select 1 from public.customers c, e where lower(c.email) = e.email);
$$;

revoke execute on function public.email_in_use(text) from public, anon, authenticated;
grant execute on function public.email_in_use(text) to service_role;

-- For the guard: an email held by staff, a pending invitation or ANOTHER customer. Private, so it
-- cannot be called from the browser to probe emails.
create function private.customer_email_taken(p_email text, p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where lower(p.email) = p_email)
      or exists (select 1 from public.staff_invitations i where i.email = p_email)
      or exists (select 1 from public.customers c where lower(c.email) = p_email and c.id <> p_customer_id);
$$;

revoke all on function private.customer_email_taken(text, uuid) from public;
grant execute on function private.customer_email_taken(text, uuid) to authenticated, service_role;

-- RLS and privileges -----------------------------------------------------------------------------
alter table public.customers enable row level security;

create policy customers_select_staff_or_own
  on public.customers
  for select
  to authenticated
  using ((select public.is_staff()) or user_id = (select auth.uid()));

create policy customers_insert_staff
  on public.customers
  for insert
  to authenticated
  with check ((select public.is_staff()));

-- A disabled customer cannot edit their data (the proxy also signs them out).
create policy customers_update_staff_or_own
  on public.customers
  for update
  to authenticated
  using ((select public.is_staff()) or (user_id = (select auth.uid()) and disabled_at is null))
  with check ((select public.is_staff()) or (user_id = (select auth.uid()) and disabled_at is null));

revoke all on table public.customers from anon, authenticated;
grant select on table public.customers to authenticated;
grant insert (full_name, email, phone) on table public.customers to authenticated;
grant update (full_name, email, phone, disabled_at) on table public.customers to authenticated;

-- Counts per status for the summary cards; RLS applies (SECURITY INVOKER).
create function public.customer_status_counts()
returns table (status public.customer_status, total bigint)
language sql
stable
set search_path = ''
as $$
  select c.status, count(*) from public.customers c group by c.status;
$$;

revoke execute on function public.customer_status_counts() from public, anon;
grant execute on function public.customer_status_counts() to authenticated, service_role;

-- CA-18: who registered a counter customer. Operators cannot read other staff profiles (spec 002,
-- RLS), so the record exposes only that name, and only to staff.
create function public.customer_registrar_name(p_customer_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name
  from public.customers c
  join public.profiles p on p.id = c.registered_by
  where c.id = p_customer_id
    and (select public.is_staff());
$$;

revoke execute on function public.customer_registrar_name(uuid) from public, anon;
grant execute on function public.customer_registrar_name(uuid) to authenticated, service_role;

-- Guard rules ------------------------------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user tells API callers (authenticated) apart from the
-- account triggers below and the service role.
create function public.customers_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from_api boolean := current_user in ('authenticated', 'anon');
  v_phone text;
begin
  if tg_op = 'INSERT' and v_from_api then
    -- Staff register a customer at the counter (CA-24): everything but the contact data is set here.
    new.user_id := null;
    new.origin := 'counter';
    new.registered_by := (select auth.uid());
    new.consent_at := now();
    new.disabled_at := null;
    new.avatar_url := null;
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.origin <> old.origin
       or new.registered_by is distinct from old.registered_by
       or new.consent_at <> old.consent_at
       or new.created_at <> old.created_at
       or (v_from_api and new.user_id is distinct from old.user_id) then
      raise exception 'customer identity columns are immutable'
        using errcode = 'check_violation', hint = 'customer_immutable_column';
    end if;

    if v_from_api then
      -- RN-10: the email of a customer with an account is the login: nobody changes it here.
      if old.user_id is not null and new.email is distinct from old.email then
        raise exception 'the email of a customer with an account cannot be changed'
          using errcode = 'insufficient_privilege', hint = 'customer_email_locked';
      end if;

      -- RN-09: only an admin disables or reactivates (the customer neither, CA-10).
      if new.disabled_at is distinct from old.disabled_at then
        if not (select public.is_admin()) then
          raise exception 'only an admin can disable or reactivate a customer'
            using errcode = 'insufficient_privilege', hint = 'customer_admin_only';
        end if;
        if new.disabled_at is not null then
          new.disabled_at := now();
        end if;
      end if;
    end if;
  end if;

  -- Normalisation (RN-01, RN-03).
  new.full_name := btrim(new.full_name);
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  v_phone := nullif(btrim(coalesce(new.phone, '')), '');
  if v_phone is null then
    new.phone := null;
  else
    new.phone := private.normalize_mobile(v_phone);
    if new.phone is null then
      raise exception 'invalid mobile phone: %', v_phone
        using errcode = 'check_violation', hint = 'customer_phone_invalid';
    end if;
  end if;

  -- RN-01 / CA-26: one email, one person across staff and customers.
  if new.email is not null
     and (tg_op = 'INSERT' or new.email is distinct from old.email)
     and private.customer_email_taken(new.email, new.id) then
    raise exception 'email already in use: %', new.email
      using errcode = 'unique_violation', hint = 'customer_email_taken';
  end if;

  return new;
end;
$$;

create trigger customers_guard
  before insert or update on public.customers
  for each row execute function public.customers_guard();

-- Customer account from a confirmed sign-up (CA-03, CA-19, CA-20, CA-28) ---------------------------
-- Runs when the email becomes confirmed (Google: already confirmed on arrival). Named so it fires
-- AFTER on_auth_user_created (triggers fire in name order), which creates staff profiles.
create function public.sync_customer_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  v_phone text := private.normalize_mobile(nullif(btrim(coalesce(v_meta ->> 'phone', '')), ''));
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;
  -- Staff never get a customer record (CA-23); an account maps to one customer only.
  if exists (select 1 from public.profiles where id = new.id)
     or exists (select 1 from public.customers where user_id = new.id) then
    return new;
  end if;

  -- CA-28: a counter record with this email becomes this person's account, keeping its data.
  update public.customers
  set user_id = new.id,
      phone = coalesce(phone, v_phone)
  where lower(email) = lower(new.email)
    and user_id is null;

  if not found then
    insert into public.customers (user_id, full_name, email, phone, origin, consent_at)
    values (
      new.id,
      btrim(coalesce(v_meta ->> 'full_name', v_meta ->> 'name')),
      lower(new.email),
      v_phone,
      case when v_provider = 'google' then 'google' else 'self_signup' end::public.customer_origin,
      new.created_at
    );
  end if;

  return new;
end;
$$;

create trigger on_auth_user_customer_sync
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.sync_customer_account();

-- The Google photo for customers too (CA-20) ------------------------------------------------------
-- Replaces the spec 002 version (profiles only).
create or replace function public.sync_profile_avatar_from_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := coalesce(new.identity_data ->> 'avatar_url', new.identity_data ->> 'picture');
begin
  -- The email identity has no photo; anything that is not https is ignored (previous photo kept).
  if new.provider = 'email' or v_url is null or v_url !~ '^https://' then
    return new;
  end if;

  update public.profiles
  set avatar_url = v_url
  where id = new.user_id
    and avatar_url is distinct from v_url;

  update public.customers
  set avatar_url = v_url
  where user_id = new.user_id
    and avatar_url is distinct from v_url;

  return new;
end;
$$;
