-- Catalogs of services and employees (spec 007).
--
-- Staff pick from these lists when they register a work order (next spec):
--   * services: what the business offers, with one optional reference price per vehicle type;
--   * employees: who does the work. They never sign in. Their name is readable by all staff;
--     their document, phone and commission live apart, in employee_details, which only an admin
--     reads (RN-07). Two tables, because column privileges are per database role and admins and
--     operators share the `authenticated` role.
-- Only an admin writes (RN-01). Nothing is ever deleted, only disabled (RN-02).
--
-- seeds: 04_catalogs.sql (local sample services and employees; real ones are entered by an admin)

-- Keys -------------------------------------------------------------------------------------------
-- RN-03: two service names are the same ignoring case and extra spaces ("Lavado  SENCILLO").
create function private.service_name_key(p_name text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select lower(regexp_replace(btrim(p_name), '[[:space:]]+', ' ', 'g'));
$$;

revoke all on function private.service_name_key(text) from public;
grant execute on function private.service_name_key(text) to authenticated, service_role;

create type public.document_type as enum ('cc', 'ce', 'ppt', 'passport');

-- Tables -----------------------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  name_key text not null generated always as (private.service_name_key(name)) stored,
  -- RN-05: whole Colombian pesos; null = not offered for that vehicle type (CA-02).
  price_motorcycle integer check (price_motorcycle between 1 and 10000000),
  price_car integer check (price_car between 1 and 10000000),
  price_bicycle integer check (price_bicycle between 1 and 10000000),
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint services_name_key_key unique (name_key),
  -- CA-03: at least one reference price.
  constraint services_price_required check (coalesce(price_motorcycle, price_car, price_bicycle) is not null)
);

comment on table public.services is
  'Services the business offers, with a reference price per vehicle type (spec 007). Never deleted.';

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (full_name = btrim(full_name) and char_length(full_name) between 1 and 120),
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.employees is
  'People who do the work (spec 007). They never sign in. Staff read the name; details are apart.';

create table public.employee_details (
  employee_id uuid primary key references public.employees (id) on delete restrict,
  document_type public.document_type not null,
  -- Kept without dots, spaces or hyphens (CA-09): digits for CC, CE and PPT; a passport may have
  -- letters, in upper case.
  document_number text not null check (
    (document_type <> 'passport' and document_number ~ '^[0-9]{3,15}$')
    or (document_type = 'passport' and document_number ~ '^[A-Z0-9]{5,20}$')
  ),
  phone text check (phone ~ '^3[0-9]{9}$'),
  -- RN-06: a whole percentage; how it applies is decided by the payroll spec.
  commission_pct smallint not null check (commission_pct between 0 and 100),
  constraint employee_details_document_key unique (document_type, document_number)
);

comment on table public.employee_details is
  'Personal and payroll data of an employee (spec 007, RN-07): only an admin reads or writes it.';

-- Duplicate lookups ------------------------------------------------------------------------------
-- SECURITY DEFINER: the guards must see every row (also disabled ones) to tell the app whether the
-- existing one is active or disabled; they return only that, never the row.
create function private.service_name_status(p_name_key text, p_exclude uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when s.disabled_at is null then 'active' else 'disabled' end
  from public.services s
  where s.name_key = p_name_key and s.id is distinct from p_exclude
  limit 1;
$$;

create function private.employee_document_status(
  p_type public.document_type, p_number text, p_exclude uuid
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when e.disabled_at is null then 'active' else 'disabled' end
  from public.employee_details d
  join public.employees e on e.id = d.employee_id
  where d.document_type = p_type and d.document_number = p_number
    and d.employee_id is distinct from p_exclude
  limit 1;
$$;

revoke all on function private.service_name_status(text, uuid) from public;
revoke all on function private.employee_document_status(public.document_type, text, uuid) from public;
grant execute on function private.service_name_status(text, uuid) to authenticated, service_role;
grant execute on function private.employee_document_status(public.document_type, text, uuid)
  to authenticated, service_role;

-- Guard rules ------------------------------------------------------------------------------------
-- Errors carry a hint the app maps to a message. SECURITY INVOKER: the rules apply to everyone.
create function public.services_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  new.name := btrim(new.name);

  if tg_op = 'INSERT' or new.name is distinct from old.name then
    v_status := private.service_name_status(private.service_name_key(new.name), new.id);
    if v_status is not null then
      raise exception 'a service with this name already exists'
        using errcode = 'unique_violation',
              hint = case v_status when 'active' then 'service_name_taken' else 'service_name_taken_disabled' end;
    end if;
  end if;

  return new;
end;
$$;

create trigger services_guard
  before insert or update on public.services
  for each row execute function public.services_guard();

create function public.employees_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.full_name := btrim(new.full_name);
  return new;
end;
$$;

create trigger employees_guard
  before insert or update on public.employees
  for each row execute function public.employees_guard();

create function public.employee_details_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  -- CA-09: "1.020.304.050" and "1020 304 050" are the same document.
  new.document_number := upper(regexp_replace(new.document_number, '[[:space:].-]', '', 'g'));
  new.phone := nullif(btrim(new.phone), '');

  if tg_op = 'INSERT' or new.document_type is distinct from old.document_type
     or new.document_number is distinct from old.document_number then
    v_status := private.employee_document_status(new.document_type, new.document_number, new.employee_id);
    if v_status is not null then
      raise exception 'an employee with this document already exists'
        using errcode = 'unique_violation',
              hint = case v_status when 'active' then 'employee_document_taken' else 'employee_document_taken_disabled' end;
    end if;
  end if;

  return new;
end;
$$;

create trigger employee_details_guard
  before insert or update on public.employee_details
  for each row execute function public.employee_details_guard();

-- RLS and privileges -----------------------------------------------------------------------------
alter table public.services enable row level security;
alter table public.employees enable row level security;
alter table public.employee_details enable row level security;

-- CA-15, CA-16: staff read; an operator only what is active, an admin everything.
create policy services_select_staff
  on public.services for select to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and disabled_at is null));
create policy services_insert_admin
  on public.services for insert to authenticated
  with check ((select public.is_admin()));
create policy services_update_admin
  on public.services for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy employees_select_staff
  on public.employees for select to authenticated
  using ((select public.is_admin()) or ((select public.is_staff()) and disabled_at is null));
create policy employees_insert_admin
  on public.employees for insert to authenticated
  with check ((select public.is_admin()));
create policy employees_update_admin
  on public.employees for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- RN-07: document, phone and commission are for an admin only.
create policy employee_details_select_admin
  on public.employee_details for select to authenticated
  using ((select public.is_admin()));
create policy employee_details_insert_admin
  on public.employee_details for insert to authenticated
  with check ((select public.is_admin()));
create policy employee_details_update_admin
  on public.employee_details for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- RN-02, CA-14: no delete for anyone; disabled_at only changes through update.
revoke all on table public.services, public.employees, public.employee_details from anon, authenticated;
grant select on table public.services, public.employees, public.employee_details to authenticated;
grant insert (name, price_motorcycle, price_car, price_bicycle) on table public.services to authenticated;
grant update (name, price_motorcycle, price_car, price_bicycle, disabled_at)
  on table public.services to authenticated;
grant insert (full_name) on table public.employees to authenticated;
grant update (full_name, disabled_at) on table public.employees to authenticated;
grant insert (employee_id, document_type, document_number, phone, commission_pct)
  on table public.employee_details to authenticated;
grant update (document_type, document_number, phone, commission_pct)
  on table public.employee_details to authenticated;

-- save_employee ----------------------------------------------------------------------------------
-- Registers (p_id null) or corrects an employee and their details in one go: both tables or
-- neither (CA-07, CA-10). SECURITY INVOKER: RLS and the guards apply, so only an admin succeeds.
create function public.save_employee(
  p_full_name text,
  p_document_type public.document_type,
  p_document_number text,
  p_commission_pct integer,
  p_phone text default null,
  -- null registers a new employee; an id corrects that one.
  p_id uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into public.employees (full_name) values (p_full_name) returning id into v_id;
    insert into public.employee_details (employee_id, document_type, document_number, phone, commission_pct)
    values (v_id, p_document_type, p_document_number, p_phone, p_commission_pct);
    return v_id;
  end if;

  update public.employees set full_name = p_full_name where id = v_id;
  if not found then
    raise exception 'employee not found' using errcode = 'no_data_found', hint = 'employee_not_found';
  end if;
  update public.employee_details
     set document_type = p_document_type, document_number = p_document_number,
         phone = p_phone, commission_pct = p_commission_pct
   where employee_id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.save_employee(text, public.document_type, text, integer, text, uuid)
  from public, anon;
grant execute on function public.save_employee(text, public.document_type, text, integer, text, uuid)
  to authenticated, service_role;
