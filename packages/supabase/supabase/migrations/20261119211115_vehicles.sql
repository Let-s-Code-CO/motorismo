-- Spec 005 — the customers' vehicles, and the brand/line catalog they are described with.
--
-- A customer has zero or more vehicles (motorcycle, bicycle or car). Staff (operator, admin)
-- manage anyone's; a customer with an account manages only their own. Brands (per type) and lines
-- (per brand) come from a catalog that is preloaded (next migration) and grows only through
-- save_vehicle, when a really new name is typed. Enforcement lives here (RLS, checks and a guard
-- trigger), never only in the UI. A car keeps the municipality that issued its plate (HU-07),
-- from a fixed list loaded by the municipalities_data migration.
--
-- seeds: supabase/seeds/03_vehicles.sql gives the local customers some vehicles.

-- Types ------------------------------------------------------------------------------------------
create type public.vehicle_type as enum ('motorcycle', 'bicycle', 'car');
-- RN-10: car → automobile ("Automóvil") or utility ("Camioneta": SUV, pickup or van);
-- bicycle → mountain ("Montaña") or road ("Ruta"); motorcycles have no class.
create type public.vehicle_class as enum ('automobile', 'utility', 'mountain', 'road');
-- RN-05, in the order the spec lists them (the app shows them in this order).
create type public.vehicle_color as enum (
  'black', 'white', 'gray', 'silver', 'red', 'burgundy', 'blue', 'green', 'yellow', 'orange',
  'brown', 'beige', 'gold', 'purple', 'pink', 'multicolor'
);

-- RN-06: two names are the same brand or line when they match ignoring case, accents, spaces and
-- hyphens ("GSX-R600" = "gsx r600" = "GSXR 600"). The app filters suggestions with the same rule
-- (catalog-key.utils.ts).
create function private.catalog_key(p_name text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select lower(private.immutable_unaccent(regexp_replace(p_name, '[[:space:]-]', '', 'g')));
$$;

revoke all on function private.catalog_key(text) from public;
grant execute on function private.catalog_key(text) to authenticated, service_role;

-- Catalog ----------------------------------------------------------------------------------------
create table public.vehicle_brands (
  id uuid primary key default gen_random_uuid(),
  vehicle_type public.vehicle_type not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  name_key text not null generated always as (private.catalog_key(name)) stored,
  created_at timestamptz not null default now(),
  constraint vehicle_brands_type_key_key unique (vehicle_type, name_key),
  -- Target of the composite foreign key from vehicles (the brand is of the vehicle's type).
  constraint vehicle_brands_id_type_key unique (id, vehicle_type)
);

comment on table public.vehicle_brands is
  'Vehicle brands per type (spec 005). Preloaded, and extended by save_vehicle with new names.';

create table public.vehicle_lines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.vehicle_brands (id),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  name_key text not null generated always as (private.catalog_key(name)) stored,
  created_at timestamptz not null default now(),
  constraint vehicle_lines_brand_key_key unique (brand_id, name_key),
  -- Target of the composite foreign key from vehicles (the line is of the vehicle's brand).
  constraint vehicle_lines_id_brand_key unique (id, brand_id)
);

comment on table public.vehicle_lines is
  'Vehicle lines (models) per brand (spec 005), e.g. Suzuki → GSX-R600.';

-- Municipalities (HU-07, RF-07) ------------------------------------------------------------------
-- The municipalities of Colombia (DANE's DIVIPOLA), for the city that issued a car's plate. Keyed
-- by the DANE code, the same in every environment (11001 = Bogotá, D.C.). Fixed: loaded by the
-- municipalities_data migration and never written through the API.
create table public.municipalities (
  code text primary key check (code ~ '^[0-9]{5}$'),
  name text not null,
  department text not null
);

comment on table public.municipalities is
  'Municipalities of Colombia (DANE DIVIPOLA) for the issuing city of a car plate (spec 005, RF-07).';

-- Vehicles ---------------------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  -- RN-01: a vehicle belongs to one customer, for good (the guard keeps it).
  customer_id uuid not null references public.customers (id),
  vehicle_type public.vehicle_type not null,
  vehicle_class public.vehicle_class,
  brand_id uuid not null,
  line_id uuid,
  displacement_cc smallint,
  color public.vehicle_color not null,
  -- Uppercase without separators (UIH03D); shown with a hyphen (UIH-03D).
  plate text,
  -- RN-11: the municipality that issued the plate, only for cars (required there).
  plate_city_code text references public.municipalities (code),
  -- Active while null (RN-07: retired, never deleted).
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicles_brand_fk foreign key (brand_id, vehicle_type)
    references public.vehicle_brands (id, vehicle_type),
  constraint vehicles_line_fk foreign key (line_id, brand_id)
    references public.vehicle_lines (id, brand_id),
  -- RN-02, RN-03: plate per type.
  constraint vehicles_plate_format check (
    case vehicle_type
      when 'motorcycle' then plate ~ '^[A-Z]{3}[0-9]{2}[A-Z]?$'
      when 'car' then plate ~ '^[A-Z]{3}[0-9]{3}$'
      else plate is null
    end
  ),
  -- RN-10: class per type.
  constraint vehicles_class_by_type check (
    case vehicle_type
      when 'car' then vehicle_class in ('automobile', 'utility')
      when 'bicycle' then vehicle_class in ('mountain', 'road')
      else vehicle_class is null
    end
  ),
  -- RN-09: displacement only for motorcycles, 50–2500 cc.
  constraint vehicles_displacement check (
    displacement_cc is null or (vehicle_type = 'motorcycle' and displacement_cc between 50 and 2500)
  ),
  -- The line is optional only on a bicycle (spec assumption).
  constraint vehicles_line_required check (vehicle_type = 'bicycle' or line_id is not null),
  -- RN-11: a car has the city of its plate; motorcycles and bicycles never have one.
  constraint vehicles_plate_city_by_type check (
    case vehicle_type when 'car' then plate_city_code is not null else plate_city_code is null end
  )
);

comment on table public.vehicles is
  'Customers'' vehicles (spec 005). Active while retired_at is null; never deleted (RN-07).';

-- RN-04: one ACTIVE vehicle per plate; a retired one frees it.
create unique index vehicles_plate_active_key on public.vehicles (plate)
  where retired_at is null and plate is not null;
create index vehicles_customer_created_at_idx on public.vehicles (customer_id, created_at desc);
create index vehicles_brand_id_idx on public.vehicles (brand_id);
create index vehicles_line_id_idx on public.vehicles (line_id);
create index vehicles_plate_city_code_idx on public.vehicles (plate_city_code);

create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

-- Helpers ----------------------------------------------------------------------------------------
-- The customer record of the session, if it is a customer.
create function private.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.customers c where c.user_id = (select auth.uid());
$$;

-- May the session add or change vehicles of this customer? Staff for any customer, a customer for
-- their own record; never while the customer is disabled (spec assumption: read-only).
create function private.can_write_vehicles_of(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customers c
    where c.id = p_customer_id
      and c.disabled_at is null
      and ((select public.is_staff()) or c.user_id = (select auth.uid()))
  );
$$;

-- RN-04 / RN-08: is the plate held by another ACTIVE vehicle, of any customer? Definer, because a
-- customer cannot read other customers' vehicles; it answers yes/no only, never whose it is.
create function private.vehicle_plate_taken(p_plate text, p_vehicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vehicles v
    where v.plate = p_plate and v.retired_at is null and v.id <> p_vehicle_id
  );
$$;

revoke all on function private.current_customer_id() from public;
revoke all on function private.can_write_vehicles_of(uuid) from public;
revoke all on function private.vehicle_plate_taken(text, uuid) from public;
grant execute on function private.current_customer_id() to authenticated, service_role;
grant execute on function private.can_write_vehicles_of(uuid) to authenticated, service_role;
grant execute on function private.vehicle_plate_taken(text, uuid) to authenticated, service_role;

-- RLS and privileges -----------------------------------------------------------------------------
alter table public.municipalities enable row level security;
alter table public.vehicle_brands enable row level security;
alter table public.vehicle_lines enable row level security;
alter table public.vehicles enable row level security;

-- Municipalities are public data: anyone with a session reads them; nobody writes them (RF-07).
create policy municipalities_select_authenticated
  on public.municipalities for select to authenticated using (true);

revoke all on table public.municipalities from anon, authenticated;
grant select on table public.municipalities to authenticated;

-- The catalog is not personal data: anyone with a session reads it; nobody writes it through the
-- API (it grows only through save_vehicle).
create policy vehicle_brands_select_authenticated
  on public.vehicle_brands for select to authenticated using (true);
create policy vehicle_lines_select_authenticated
  on public.vehicle_lines for select to authenticated using (true);

revoke all on table public.vehicle_brands, public.vehicle_lines from anon, authenticated;
grant select on table public.vehicle_brands, public.vehicle_lines to authenticated;

-- Plates are personal data: staff read every vehicle, a customer only their own (CA-26).
create policy vehicles_select_staff_or_own
  on public.vehicles
  for select
  to authenticated
  using ((select public.is_staff()) or customer_id = (select private.current_customer_id()));

create policy vehicles_insert_staff_or_own
  on public.vehicles
  for insert
  to authenticated
  with check (private.can_write_vehicles_of(customer_id));

create policy vehicles_update_staff_or_own
  on public.vehicles
  for update
  to authenticated
  using (private.can_write_vehicles_of(customer_id))
  with check (private.can_write_vehicles_of(customer_id));

-- No delete (RN-07); customer_id is set on insert only (RN-01).
revoke all on table public.vehicles from anon, authenticated;
grant select on table public.vehicles to authenticated;
grant insert (customer_id, vehicle_type, vehicle_class, brand_id, line_id, displacement_cc, color, plate,
               plate_city_code)
  on table public.vehicles to authenticated;
grant update (vehicle_type, vehicle_class, brand_id, line_id, displacement_cc, color, plate, retired_at,
               plate_city_code)
  on table public.vehicles to authenticated;

-- Guard rules ------------------------------------------------------------------------------------
-- Errors carry a hint the app maps to a message. SECURITY INVOKER: the rules apply to everyone,
-- the database owner included.
create function public.vehicles_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- CA-22, RN-07: a retired vehicle is final (no edits, no way back).
    if old.retired_at is not null then
      raise exception 'a retired vehicle cannot change'
        using errcode = 'check_violation', hint = 'vehicle_retired';
    end if;
    -- RN-01: the owner and the identity of a vehicle never change.
    if new.id <> old.id or new.customer_id <> old.customer_id or new.created_at <> old.created_at then
      raise exception 'vehicle identity columns are immutable'
        using errcode = 'check_violation', hint = 'vehicle_immutable_column';
    end if;
  end if;

  -- The retirement date is the database's, whatever the caller sent; a new vehicle is active.
  if tg_op = 'INSERT' then
    new.retired_at := null;
  elsif new.retired_at is not null then
    new.retired_at := now();
  end if;

  -- RN-03: uppercase, without spaces, hyphens or dots.
  new.plate := nullif(upper(regexp_replace(coalesce(new.plate, ''), '[[:space:].-]', '', 'g')), '');

  -- CA-09: nothing is kept that does not belong to the type.
  if new.vehicle_type = 'bicycle' then
    new.plate := null;
  end if;
  -- RN-11, CA-31: only a car keeps the city of its plate.
  if new.vehicle_type <> 'car' then
    new.plate_city_code := null;
  end if;
  if new.vehicle_type = 'motorcycle' then
    new.vehicle_class := null;
  else
    new.displacement_cc := null;
  end if;

  if new.vehicle_type <> 'bicycle' and new.plate is null then
    raise exception 'a % needs a plate', new.vehicle_type
      using errcode = 'check_violation', hint = 'vehicle_plate_required';
  end if;
  if (new.vehicle_type = 'motorcycle' and new.plate !~ '^[A-Z]{3}[0-9]{2}[A-Z]?$')
     or (new.vehicle_type = 'car' and new.plate !~ '^[A-Z]{3}[0-9]{3}$') then
    raise exception 'invalid plate for a %: %', new.vehicle_type, new.plate
      using errcode = 'check_violation', hint = 'vehicle_plate_invalid';
  end if;
  if (new.vehicle_type = 'car' and new.vehicle_class is distinct from 'automobile' and new.vehicle_class is distinct from 'utility')
     or (new.vehicle_type = 'bicycle' and new.vehicle_class is distinct from 'mountain' and new.vehicle_class is distinct from 'road') then
    raise exception 'a % needs a class of its type', new.vehicle_type
      using errcode = 'check_violation', hint = 'vehicle_class_required';
  end if;
  if new.vehicle_type <> 'bicycle' and new.line_id is null then
    raise exception 'a % needs a line', new.vehicle_type
      using errcode = 'check_violation', hint = 'vehicle_line_required';
  end if;
  if new.displacement_cc is not null and new.displacement_cc not between 50 and 2500 then
    raise exception 'displacement out of range: % cc', new.displacement_cc
      using errcode = 'check_violation', hint = 'vehicle_displacement_invalid';
  end if;
  -- RN-11: a car needs the city of its plate, from the municipalities list (CA-31). Checked here,
  -- with a hint, before the foreign key would refuse an unknown code.
  if new.vehicle_type = 'car' and new.plate_city_code is null then
    raise exception 'a car needs the city of its plate'
      using errcode = 'check_violation', hint = 'vehicle_plate_city_required';
  end if;
  if new.plate_city_code is not null
     and not exists (select 1 from public.municipalities m where m.code = new.plate_city_code) then
    raise exception 'unknown plate city: %', new.plate_city_code
      using errcode = 'check_violation', hint = 'vehicle_plate_city_invalid';
  end if;

  -- RN-04, RN-08: one active vehicle per plate, without telling whose it is.
  if new.retired_at is null
     and new.plate is not null
     and (tg_op = 'INSERT' or new.plate is distinct from old.plate or old.retired_at is not null)
     and private.vehicle_plate_taken(new.plate, new.id) then
    raise exception 'plate already registered'
      using errcode = 'unique_violation', hint = 'vehicle_plate_taken';
  end if;

  return new;
end;
$$;

create trigger vehicles_guard
  before insert or update on public.vehicles
  for each row execute function public.vehicles_guard();

-- Saving a vehicle (CA-13, CA-14, RF-05) -----------------------------------------------------------
-- Finds a brand of the type by its catalog key or adds it, written as given (trimmed, inner
-- spaces collapsed). Definer: the catalog is not writable from the API.
create function private.ensure_vehicle_brand(p_type public.vehicle_type, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
  v_id uuid;
begin
  if v_name = '' then
    raise exception 'the brand is required'
      using errcode = 'check_violation', hint = 'vehicle_brand_required';
  end if;

  insert into public.vehicle_brands (vehicle_type, name) values (p_type, v_name)
  on conflict (vehicle_type, name_key) do nothing
  returning id into v_id;

  if v_id is null then
    select b.id into v_id from public.vehicle_brands b
    where b.vehicle_type = p_type and b.name_key = private.catalog_key(v_name);
  end if;
  return v_id;
end;
$$;

-- Same for a line of a brand; an empty name is "no line" (null).
create function private.ensure_vehicle_line(p_brand_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
  v_id uuid;
begin
  if v_name = '' then
    return null;
  end if;

  insert into public.vehicle_lines (brand_id, name) values (p_brand_id, v_name)
  on conflict (brand_id, name_key) do nothing
  returning id into v_id;

  if v_id is null then
    select l.id into v_id from public.vehicle_lines l
    where l.brand_id = p_brand_id and l.name_key = private.catalog_key(v_name);
  end if;
  return v_id;
end;
$$;

revoke all on function private.ensure_vehicle_brand(public.vehicle_type, text) from public;
revoke all on function private.ensure_vehicle_line(uuid, text) from public;
grant execute on function private.ensure_vehicle_brand(public.vehicle_type, text) to authenticated, service_role;
grant execute on function private.ensure_vehicle_line(uuid, text) to authenticated, service_role;

-- Registers (p_vehicle_id null) or corrects a vehicle, with the brand and line given BY NAME. One
-- transaction: if the vehicle is refused (RLS, guard), a brand or line added for it is undone too.
-- SECURITY INVOKER: the vehicle itself is written with the caller's session (RLS + guard).
create function public.save_vehicle(
  p_customer_id uuid,
  p_vehicle_type public.vehicle_type,
  p_brand_name text,
  p_color public.vehicle_color,
  p_vehicle_class public.vehicle_class default null,
  p_line_name text default null,
  p_displacement_cc integer default null,
  p_plate text default null,
  p_vehicle_id uuid default null,
  p_plate_city_code text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_brand_id uuid := private.ensure_vehicle_brand(p_vehicle_type, p_brand_name);
  v_line_id uuid := private.ensure_vehicle_line(v_brand_id, p_line_name);
  v_id uuid;
begin
  if p_vehicle_id is null then
    insert into public.vehicles (customer_id, vehicle_type, vehicle_class, brand_id, line_id,
                                 displacement_cc, color, plate, plate_city_code)
    values (p_customer_id, p_vehicle_type, p_vehicle_class, v_brand_id, v_line_id,
            p_displacement_cc, p_color, p_plate, p_plate_city_code)
    returning id into v_id;
  else
    update public.vehicles
    set vehicle_type = p_vehicle_type,
        vehicle_class = p_vehicle_class,
        brand_id = v_brand_id,
        line_id = v_line_id,
        displacement_cc = p_displacement_cc,
        color = p_color,
        plate = p_plate,
        plate_city_code = p_plate_city_code
    where id = p_vehicle_id and customer_id = p_customer_id
    returning id into v_id;

    -- Not visible, not writable (RLS) or of another customer: the same answer for all.
    if v_id is null then
      raise exception 'vehicle not found'
        using errcode = 'no_data_found', hint = 'vehicle_not_found';
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.save_vehicle(uuid, public.vehicle_type, text, public.vehicle_color,
  public.vehicle_class, text, integer, text, uuid, text) from public, anon;
grant execute on function public.save_vehicle(uuid, public.vehicle_type, text, public.vehicle_color,
  public.vehicle_class, text, integer, text, uuid, text) to authenticated, service_role;

-- Plate search in "Clientes" (CA-17, CA-18) --------------------------------------------------------
-- The active plates of a customer, copied to their record so the existing search (spec 004:
-- search_text, trigram index, pagination and counts) also finds them.
alter table public.customers add column vehicle_plates text not null default '';

comment on column public.customers.vehicle_plates is
  'Active vehicle plates of the customer, space-separated, oldest first. Kept by a vehicles trigger.';

create function public.sync_customer_vehicle_plates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.customers c
  set vehicle_plates = coalesce((
    select string_agg(v.plate, ' ' order by v.created_at, v.id)
    from public.vehicles v
    where v.customer_id = new.customer_id and v.retired_at is null and v.plate is not null
  ), '')
  where c.id = new.customer_id;
  return null;
end;
$$;

create trigger vehicles_sync_customer_plates
  after insert or update of plate, retired_at on public.vehicles
  for each row execute function public.sync_customer_vehicle_plates();

-- search_text now also carries the plates (drop + add: a generated expression cannot be altered;
-- its trigram index goes with the column and is recreated).
alter table public.customers drop column search_text;
alter table public.customers add column search_text text not null generated always as (
  lower(private.immutable_unaccent(
    full_name || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '') || ' ' || vehicle_plates
  ))
) stored;

comment on column public.customers.search_text is
  'Generated: lowercase, accent-free name + email + phone + active plates, for the staff search (CA-16; spec 005 CA-17).';

create index customers_search_text_trgm_idx on public.customers using gin (search_text extensions.gin_trgm_ops);
