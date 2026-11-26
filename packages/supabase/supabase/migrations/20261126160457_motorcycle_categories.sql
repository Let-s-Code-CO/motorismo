-- Motorcycle categories and prices by category (spec 024).
--
-- * Eight categories (RF-01). A motorcycle line has one, set by an admin (CA-01); a motorcycle takes
--   its line's unless staff gave it its own (CA-02, CA-03, RN-04). Only staff set it (CA-05, RN-03).
-- * A service's motorcycle value is single or one per category, all eight or none (RF-02, CA-07,
--   CA-08), in one row as before; a service may be «a convenir» (on quote: no values nor time, for any
--   vehicle, RF-03, CA-12), and carry a description (CA-19).
-- * Order lines take the value of the motorcycle's category (CA-10); without one, the order asks for
--   it (CA-06); a service on quote needs its value written (CA-13, RN-02).
-- * A reservation keeps the time staff give a service on quote (CA-14); a customer cannot book one
--   (CA-16).
-- * Packages and what they include (HU-05): a service may include others, inherited (RF-04); a
--   reservation or an order carries one package at most (RN-05) and no two services that share what
--   they include (RN-06, CA-26).
-- * Data for every environment: the categories of the 173 initial motorcycle lines (CA-18) and the
--   business's price list (CA-17) with what its packages include (CA-22), loaded once; the admin
--   changes them later.
--
-- seeds: changed — 04_catalogs no longer inserts example services (the list comes here); 05 and 06 use
-- the new names.

-- Categories (RF-01) -------------------------------------------------------------------------------------
create type public.motorcycle_category as enum (
  'street', 'sbk', 'scooter', 'maxi_scooter', 'trail', 'maxi_trail', 'cruiser', 'maxi_cruiser'
);
comment on type public.motorcycle_category is
  'Street/Roadster, SBK/SSP, Scooter, Maxi Scooter, Trail, Maxi Trail, Cruiser/Clásica, Maxi Cruiser (spec 024).';

-- Lines (CA-01, CA-18) -----------------------------------------------------------------------------------
alter table public.vehicle_lines add column motorcycle_category public.motorcycle_category;
comment on column public.vehicle_lines.motorcycle_category is
  'The category of a motorcycle line (spec 024, CA-01); null for other types and for lines not classified yet.';

-- Only a motorcycle line has a category.
create function public.vehicle_lines_category_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.motorcycle_category is not null
     and not exists (select 1 from public.vehicle_brands b where b.id = new.brand_id and b.vehicle_type = 'motorcycle') then
    raise exception 'only a motorcycle line has a category'
      using errcode = 'check_violation', hint = 'catalog_category_motorcycle_only';
  end if;
  return new;
end;
$$;
revoke all on function public.vehicle_lines_category_guard() from public, anon, authenticated;
create trigger vehicle_lines_category_guard
  before insert or update of motorcycle_category, brand_id on public.vehicle_lines
  for each row execute function public.vehicle_lines_category_guard();

-- Staff need it when registering a motorcycle and in an order: it is neither personal nor a price.
grant select (motorcycle_category) on table public.vehicle_lines to authenticated;

-- Motorcycles (CA-02, CA-03, CA-05, CA-06, RN-04) ----------------------------------------------------------
alter table public.vehicles add column motorcycle_category public.motorcycle_category;
alter table public.vehicles add constraint vehicles_category_motorcycle_only
  check (motorcycle_category is null or vehicle_type = 'motorcycle');
comment on column public.vehicles.motorcycle_category is
  'A motorcycle''s own category, given by staff (spec 024, CA-03); null follows its line''s (RN-04).';
grant insert (motorcycle_category), update (motorcycle_category) on table public.vehicles to authenticated;

-- The category that counts: the motorcycle's own or, without one, its line's (RN-04).
create function private.vehicle_category(p_vehicle_id uuid)
returns public.motorcycle_category
language sql
stable
set search_path = ''
as $$
  select coalesce(v.motorcycle_category, l.motorcycle_category)
  from public.vehicles v
  left join public.vehicle_lines l on l.id = v.line_id
  where v.id = p_vehicle_id and v.vehicle_type = 'motorcycle';
$$;
revoke all on function private.vehicle_category(uuid) from public;

-- vehicles_guard, from its last version (spec 023), with the category rule ------------------------------
create or replace function public.vehicles_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- Spec 017, RN-05: erasing a customer's data retires their vehicles and removes their plates, also
  -- of the ones already retired. Only erase_customer_data turns this on, for its own transaction.
  if tg_op = 'UPDATE' and current_setting('motorismo.erasing', true) = 'on' then
    return new;
  end if;
  -- Spec 018: merging brands or lines, or moving a line, passes every vehicle to the brand and line
  -- that stay, retired ones too. Only those functions turn this on, for their own transaction, and
  -- only the brand and the line may change: anything else goes through the checks below.
  if tg_op = 'UPDATE' and current_setting('motorismo.recataloging', true) = 'on'
     and (to_jsonb(new) - array['brand_id', 'line_id', 'updated_at'])
         = (to_jsonb(old) - array['brand_id', 'line_id', 'updated_at']) then
    return new;
  end if;
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
  -- Spec 024, CA-05, RN-03: only staff give a motorcycle its own category (a customer correcting their
  -- motorcycle from the app never touches it).
  if ((tg_op = 'INSERT' and new.motorcycle_category is not null)
      or (tg_op = 'UPDATE' and new.motorcycle_category is distinct from old.motorcycle_category))
     and not (select public.is_staff()) then
    raise exception 'only staff set a motorcycle''s category'
      using errcode = 'insufficient_privilege', hint = 'vehicle_category_staff_only';
  end if;
  if new.vehicle_type = 'motorcycle' then
    new.vehicle_class := null;
  else
    new.displacement_cc := null;
    new.motorcycle_category := null;
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
  -- Spec 023, RN-04: a plate city is chosen among the municipalities that issue plates. Only when it
  -- is set or changed: a car registered before with another city keeps it (CA-08).
  if new.plate_city_code is not null
     and (tg_op = 'INSERT' or new.plate_city_code is distinct from old.plate_city_code)
     and not exists (select 1 from public.municipalities m
                     where m.code = new.plate_city_code and m.issues_plates) then
    raise exception 'the municipality issues no plates: %', new.plate_city_code
      using errcode = 'check_violation', hint = 'vehicle_plate_city_not_issuing';
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
$function$;

-- save_vehicle: the motorcycle's own category, written only when asked (CA-03); a customer's call
-- never asks (and the guard refuses it if it did). The signature grows: dropped and created again.
drop function public.save_vehicle(uuid, public.vehicle_type, text, public.vehicle_color, public.vehicle_class,
  text, integer, text, uuid, text);

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
  p_plate_city_code text default null,
  -- Spec 024: the motorcycle's own category, and whether to write it (null with true: follow the line).
  p_motorcycle_category public.motorcycle_category default null,
  p_set_category boolean default false
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
                                 displacement_cc, color, plate, plate_city_code, motorcycle_category)
    values (p_customer_id, p_vehicle_type, p_vehicle_class, v_brand_id, v_line_id,
            p_displacement_cc, p_color, p_plate, p_plate_city_code,
            case when p_set_category then p_motorcycle_category end)
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
        plate_city_code = p_plate_city_code,
        motorcycle_category = case when p_set_category then p_motorcycle_category else motorcycle_category end
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
  public.vehicle_class, text, integer, text, uuid, text, public.motorcycle_category, boolean) from public, anon;
grant execute on function public.save_vehicle(uuid, public.vehicle_type, text, public.vehicle_color,
  public.vehicle_class, text, integer, text, uuid, text, public.motorcycle_category, boolean)
  to authenticated, service_role;

-- set_vehicle_category: staff give a motorcycle without category its category from an order (CA-06).
create function public.set_vehicle_category(p_vehicle_id uuid, p_category public.motorcycle_category)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_staff()) then
    raise exception 'only staff set a motorcycle''s category'
      using errcode = 'insufficient_privilege', hint = 'vehicle_category_staff_only';
  end if;
  update public.vehicles set motorcycle_category = p_category
   where id = p_vehicle_id and vehicle_type = 'motorcycle' and retired_at is null;
  if not found then
    raise exception 'motorcycle not found' using errcode = 'no_data_found', hint = 'vehicle_not_found';
  end if;
end;
$$;
revoke execute on function public.set_vehicle_category(uuid, public.motorcycle_category) from public, anon;
grant execute on function public.set_vehicle_category(uuid, public.motorcycle_category) to authenticated, service_role;

-- The catalog of the admin (spec 018): the category of each line, and setting it (CA-01) --------------------
create or replace function public.vehicle_catalog(p_type public.vehicle_type)
returns table (
  id uuid, name text, reviewed boolean, created_at timestamptz, vehicles integer, lines jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_admin_for_vehicle_catalog();

  return query
  select b.id, b.name, b.reviewed, b.created_at,
         (select count(*)::integer from public.vehicles v where v.brand_id = b.id),
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', l.id, 'name', l.name, 'reviewed', l.reviewed, 'created_at', l.created_at,
                    'vehicles', (select count(*) from public.vehicles v where v.line_id = l.id),
                    'category', l.motorcycle_category)
                  order by l.name_key, l.name)
           from public.vehicle_lines l
           where l.brand_id = b.id
         ), '[]'::jsonb)
  from public.vehicle_brands b
  where b.vehicle_type = p_type
  order by b.name_key, b.name;
end;
$$;

-- Like every other action of the admin on a line, it leaves the line reviewed (spec 018, RN-07).
create function public.set_vehicle_line_category(p_line_id uuid, p_category public.motorcycle_category)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_vehicle_catalog();
  update public.vehicle_lines set motorcycle_category = p_category, reviewed = true where id = p_line_id;
  if not found then
    raise exception 'line not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;
end;
$$;
revoke execute on function public.set_vehicle_line_category(uuid, public.motorcycle_category) from public, anon;
grant execute on function public.set_vehicle_line_category(uuid, public.motorcycle_category) to authenticated, service_role;


-- Services (RF-02, RF-03, CA-07, CA-08, CA-12, CA-19) ---------------------------------------------------------
-- The eight values by category, all of them (CA-08), each a whole number of pesos from 1 to 10.000.000.
create function private.valid_category_prices(p_prices jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_prices is null or (
    jsonb_typeof(p_prices) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(p_prices) k)
        = array['cruiser', 'maxi_cruiser', 'maxi_scooter', 'maxi_trail', 'sbk', 'scooter', 'street', 'trail']
    and not exists (
      select 1 from jsonb_each(p_prices) e
      where jsonb_typeof(e.value) <> 'number'
         or e.value::numeric <> trunc(e.value::numeric)
         or e.value::numeric not between 1 and 10000000));
$$;

alter table public.services
  add column motorcycle_prices jsonb,
  add column on_quote boolean not null default false,
  add column description text;
alter table public.services
  add constraint services_motorcycle_prices_valid check (private.valid_category_prices(motorcycle_prices)),
  -- CA-07: a single value or one per category, never both.
  add constraint services_motorcycle_single_or_by_category
    check (price_motorcycle is null or motorcycle_prices is null),
  -- CA-12: «a convenir» has no values nor time.
  add constraint services_on_quote_without_values check (
    not on_quote or (price_motorcycle is null and price_car is null and price_bicycle is null
                     and motorcycle_prices is null and estimated_minutes is null)),
  add constraint services_description_length
    check (description is null or char_length(btrim(description)) between 1 and 300);
alter table public.services drop constraint services_price_required;
alter table public.services add constraint services_price_required check (
  on_quote or motorcycle_prices is not null or coalesce(price_motorcycle, price_car, price_bicycle) is not null);

comment on column public.services.motorcycle_prices is
  'The motorcycle value per category, all eight (spec 024, CA-07); null when it is single or not offered.';
comment on column public.services.on_quote is
  '«A convenir» (spec 024, CA-12): no values nor time; they are written in each order or reservation.';

grant insert (motorcycle_prices, on_quote, description), update (motorcycle_prices, on_quote, description)
  on table public.services to authenticated;

-- The reference value of a service for a vehicle: by category, single, or none (on quote, or not offered).
create function private.service_price(
  p_service public.services, p_vehicle_type public.vehicle_type, p_category public.motorcycle_category
)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_service.on_quote then null
    when p_vehicle_type = 'motorcycle' and p_service.motorcycle_prices is not null
      then (p_service.motorcycle_prices ->> p_category::text)::integer
    when p_vehicle_type = 'motorcycle' then p_service.price_motorcycle
    when p_vehicle_type = 'car' then p_service.price_car
    else p_service.price_bicycle
  end;
$$;

-- Whether a service is offered for a vehicle type: on quote (any vehicle), or with a value for it.
create function private.service_offered(p_service public.services, p_vehicle_type public.vehicle_type)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_service.on_quote or case p_vehicle_type
    when 'motorcycle' then p_service.price_motorcycle is not null or p_service.motorcycle_prices is not null
    when 'car' then p_service.price_car is not null
    else p_service.price_bicycle is not null
  end;
$$;
revoke all on function private.valid_category_prices(jsonb),
  private.service_price(public.services, public.vehicle_type, public.motorcycle_category),
  private.service_offered(public.services, public.vehicle_type) from public;
-- The constraint runs with the privileges of whoever writes the service (the admin, through RLS).
grant execute on function private.valid_category_prices(jsonb) to authenticated, service_role;


-- What a service includes (HU-05: RF-04, CA-20) -----------------------------------------------------------------
create table public.service_inclusions (
  service_id uuid not null references public.services (id) on delete cascade,
  included_id uuid not null references public.services (id) on delete cascade,
  primary key (service_id, included_id),
  constraint service_inclusions_not_itself check (service_id <> included_id)
);
comment on table public.service_inclusions is
  'The services a service includes (spec 024, HU-05): what is included is not chosen apart (RN-06).';
create index service_inclusions_included_idx on public.service_inclusions (included_id);
alter table public.service_inclusions enable row level security;
create policy service_inclusions_select_staff
  on public.service_inclusions for select to authenticated
  using ((select public.is_staff()));
revoke all on table public.service_inclusions from anon, authenticated;
grant select on table public.service_inclusions to authenticated;

-- A service and everything it includes, inherited (RF-04): a combo → its kit → the chain → its grease.
create function private.service_closure(p_service_id uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  with recursive closure (id) as (
    select p_service_id
    union
    select si.included_id from public.service_inclusions si join closure c on si.service_id = c.id
  )
  select id from closure;
$$;
revoke all on function private.service_closure(uuid) from public;

-- The admin replaces what a service includes (CA-20): never itself, nor one that already includes it.
create function public.set_service_inclusions(p_service_id uuid, p_included uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'only an admin sets what a service includes'
      using errcode = '42501', hint = 'service_admin_only';
  end if;
  if not exists (select 1 from public.services where id = p_service_id) then
    raise exception 'service not found' using errcode = 'P0002', hint = 'service_not_found';
  end if;
  delete from public.service_inclusions where service_id = p_service_id;
  if exists (select 1 from unnest(coalesce(p_included, '{}')) i
             where i = p_service_id or p_service_id in (select private.service_closure(i))) then
    raise exception 'a service cannot include itself, nor one that includes it'
      using errcode = '23514', hint = 'service_inclusion_cycle';
  end if;
  insert into public.service_inclusions (service_id, included_id)
  select p_service_id, i from unnest(coalesce(p_included, '{}')) i
  on conflict do nothing;
end;
$$;
revoke execute on function public.set_service_inclusions(uuid, uuid[]) from public, anon;
grant execute on function public.set_service_inclusions(uuid, uuid[]) to authenticated, service_role;

-- The services of a reservation or an order: one package at most (RN-05: a package has values by
-- category) and no two that share what they include, each counting as including itself (RN-06). A
-- service chosen twice shares itself.
create function private.check_service_combination(p_service_ids uuid[])
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (select count(*) from public.services
      where id = any (coalesce(p_service_ids, '{}')) and motorcycle_prices is not null) > 1 then
    raise exception 'one package at most' using errcode = '23514', hint = 'services_one_package';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_service_ids, '{}')) with ordinality a (id, i)
    join unnest(coalesce(p_service_ids, '{}')) with ordinality b (id, j) on a.i < b.j
    where exists (select private.service_closure(a.id) intersect select private.service_closure(b.id))
  ) then
    raise exception 'two services share what they include' using errcode = '23514', hint = 'services_overlap';
  end if;
end;
$$;
revoke all on function private.check_service_combination(uuid[]) from public;

-- Orders (CA-06, CA-10, CA-13, RN-01, RN-02) ----------------------------------------------------------------
-- work_order_write_lines, from its version of spec 008, with the value by category and on quote. Its
-- signature does not change: save_work_order and correct_work_order keep calling it.
create or replace function private.work_order_write_lines(
  p_order_id uuid, p_vehicle_type public.vehicle_type, p_lines jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_elem jsonb;
  v_position int;
  v_line_id uuid;
  v_keep uuid[] := '{}';
  v_existing public.work_order_lines;
  v_service public.services;
  v_name text;
  v_price int;
  v_minutes int;
  v_previous uuid[];
  v_share jsonb;
  v_sum int;
  v_category public.motorcycle_category;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform private.work_order_fail('23514', 'work_order_lines_required', 'an order needs at least one service');
  end if;

  for v_elem, v_position in select e, i from jsonb_array_elements(p_lines) with ordinality as x(e, i) loop
    v_line_id := nullif(v_elem ->> 'id', '')::uuid;

    if v_line_id is not null then
      select * into v_existing from public.work_order_lines
       where id = v_line_id and work_order_id = p_order_id;
      if not found then
        perform private.work_order_fail('P0002', 'work_order_line_not_found', 'line not found in this order');
      end if;
      v_name := case when v_existing.service_id is null then btrim(coalesce(v_elem ->> 'name', v_existing.name))
                     else v_existing.name end;
      v_price := coalesce((v_elem ->> 'price')::int, v_existing.price);
      v_minutes := case when v_elem ? 'estimated_minutes' then (v_elem ->> 'estimated_minutes')::int
                        else v_existing.estimated_minutes end;
      if v_existing.service_id is null and coalesce(v_name, '') = '' then
        perform private.work_order_fail('23514', 'work_order_other_name_required', '«Otro» needs a description');
      end if;
      update public.work_order_lines
         set position = v_position, name = v_name, price = v_price, estimated_minutes = v_minutes
       where id = v_line_id;
    else
      if nullif(v_elem ->> 'service_id', '') is not null then
        select * into v_service from public.services
         where id = (v_elem ->> 'service_id')::uuid and disabled_at is null;
        if v_service.id is null or not private.service_offered(v_service, p_vehicle_type) then
          perform private.work_order_fail('23514', 'work_order_service_unavailable',
            'the service is not offered for this vehicle');
        end if;
        -- Spec 024, CA-06: a value by category needs the motorcycle's category.
        if p_vehicle_type = 'motorcycle' and v_service.motorcycle_prices is not null then
          select private.vehicle_category(o.vehicle_id) into v_category
            from public.work_orders o where o.id = p_order_id;
          if v_category is null then
            perform private.work_order_fail('23514', 'work_order_category_required',
              'the motorcycle needs its category for this service');
          end if;
        end if;
        v_name := v_service.name;
        -- CA-10: the value of its category; CA-13, RN-02: on quote, the value written, required.
        v_price := coalesce((v_elem ->> 'price')::int,
                            private.service_price(v_service, p_vehicle_type, v_category));
        if v_price is null then
          perform private.work_order_fail('23514', 'work_order_price_required', 'a line needs a price');
        end if;
        v_minutes := case when v_elem ? 'estimated_minutes' then (v_elem ->> 'estimated_minutes')::int
                          else v_service.estimated_minutes end;
      else
        v_service := null;
        v_name := btrim(coalesce(v_elem ->> 'name', ''));
        if v_name = '' then
          perform private.work_order_fail('23514', 'work_order_other_name_required', '«Otro» needs a description');
        end if;
        v_price := (v_elem ->> 'price')::int;
        if v_price is null then
          perform private.work_order_fail('23514', 'work_order_price_required', 'a line needs a price');
        end if;
        v_minutes := (v_elem ->> 'estimated_minutes')::int;
      end if;
      insert into public.work_order_lines (work_order_id, position, service_id, name, price, estimated_minutes)
      values (p_order_id, v_position, v_service.id, v_name, v_price, v_minutes)
      returning id into v_line_id;
    end if;
    v_keep := v_keep || v_line_id;

    -- Employees: replaced only when sent.
    if v_elem ? 'employees' then
      select coalesce(array_agg(employee_id), '{}') into v_previous
        from public.work_order_line_employees where line_id = v_line_id;
      delete from public.work_order_line_employees where line_id = v_line_id;
      v_sum := 0;
      for v_share in select * from jsonb_array_elements(coalesce(v_elem -> 'employees', '[]'::jsonb)) loop
        if not ((v_share ->> 'employee_id')::uuid = any (v_previous))
           and not exists (select 1 from public.employees
                            where id = (v_share ->> 'employee_id')::uuid and disabled_at is null) then
          perform private.work_order_fail('23514', 'work_order_employee_unavailable',
            'the employee is not active');
        end if;
        insert into public.work_order_line_employees (line_id, employee_id, share_pct)
        values (v_line_id, (v_share ->> 'employee_id')::uuid, (v_share ->> 'share_pct')::int);
        v_sum := v_sum + (v_share ->> 'share_pct')::int;
      end loop;
      if v_sum <> 0 and v_sum <> 100 then
        perform private.work_order_fail('23514', 'work_order_shares_invalid', 'shares must add up to 100');
      end if;
    end if;
  end loop;

  delete from public.work_order_lines where work_order_id = p_order_id and not (id = any (v_keep));

  -- Spec 024, RN-05 / RN-06: the services of the order, «Otro» apart.
  perform private.check_service_combination(
    (select array_agg(service_id) from public.work_order_lines
     where work_order_id = p_order_id and service_id is not null));
end;
$$;


-- Reservations (CA-14 to CA-16) -----------------------------------------------------------------------------
-- The time staff give a service on quote in a reservation.
alter table public.reservation_services add column estimated_minutes smallint
  check (estimated_minutes is null or estimated_minutes between 5 and 1440);
comment on column public.reservation_services.estimated_minutes is
  'The time of a service on quote in this reservation, given by staff (spec 024, CA-14).';

-- save_reservation, from its version of spec 021, with the time of the services on quote. The
-- signature grows: dropped and created again.
drop function public.save_reservation(uuid, uuid, timestamptz, uuid[], text, uuid);

create function public.save_reservation(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_slot_start timestamptz,
  p_service_ids uuid[] default '{}',
  p_notes text default null,
  p_id uuid default null,
  -- Spec 024, CA-14: the time of each service on quote, {service id: minutes}, given by staff.
  p_service_minutes jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.reservations;
  v_customer public.customers;
  v_vehicle public.vehicles;
  v_customer_id uuid := p_customer_id;
  v_day date;
  v_day_row public.agenda_days;
  v_enabled boolean;
  v_slot_end timestamptz;
  v_seats int;
  v_service public.services;
  v_service_id uuid;
  v_position int := 0;
  v_slot_changed boolean := true;
  v_id uuid;
  v_staff boolean := (select public.is_staff());
  v_me uuid;
  v_minutes int;
begin
  -- Spec 014: besides staff, a customer books for themselves (RN-01).
  if not v_staff then
    v_me := private.active_customer_id();
    if v_me is null or p_customer_id is distinct from v_me then
      perform private.agenda_fail('42501', 'reservation_customer_only', 'a customer books only for themselves');
    end if;
  end if;

  if p_id is not null then
    select * into v_reservation from public.reservations where id = p_id for update;
    if not found then
      perform private.agenda_fail('P0002', 'reservation_not_found', 'reservation not found');
    end if;
    if not v_staff and v_reservation.customer_id <> v_me then
      perform private.agenda_fail('42501', 'reservation_customer_only', 'a customer changes only their own reservations');
    end if;
    if v_reservation.status <> 'pending' then
      perform private.agenda_fail('23514', 'reservation_not_pending', 'only a pending reservation changes');
    end if;
    v_customer_id := v_reservation.customer_id;
    v_slot_changed := v_reservation.slot_start is distinct from p_slot_start;
  end if;

  select * into v_customer from public.customers where id = v_customer_id;
  if not found then
    perform private.agenda_fail('P0002', 'reservation_customer_not_found', 'customer not found');
  end if;
  if v_customer.disabled_at is not null then
    perform private.agenda_fail('23514', 'reservation_customer_disabled', 'the customer is disabled');
  end if;

  if p_vehicle_id is not null then
    select * into v_vehicle from public.vehicles where id = p_vehicle_id;
    if not found or v_vehicle.customer_id <> v_customer_id then
      perform private.agenda_fail('23514', 'reservation_vehicle_invalid', 'the vehicle is not the customer''s');
    end if;
    if v_vehicle.retired_at is not null then
      perform private.agenda_fail('23514', 'reservation_vehicle_retired', 'the vehicle is retired');
    end if;
  end if;

  -- CA-04: active services, with a price for the vehicle's type when there is one.
  foreach v_service_id in array coalesce(p_service_ids, '{}') loop
    select * into v_service from public.services where id = v_service_id;
    if not found or v_service.disabled_at is not null then
      perform private.agenda_fail('23514', 'reservation_service_inactive', 'the service is not active');
    end if;
    if p_vehicle_id is not null and not private.service_offered(v_service, v_vehicle.vehicle_type) then
      perform private.agenda_fail('23514', 'reservation_service_unavailable', 'the service is not offered for this vehicle');
    end if;
    -- Spec 024, CA-16: a service on quote is agreed with staff first; CA-14: staff give its time.
    if v_service.on_quote then
      if not v_staff then
        perform private.agenda_fail('42501', 'reservation_service_quoted', 'a service on quote is booked by staff');
      end if;
      v_minutes := (p_service_minutes ->> v_service_id::text)::int;
      if v_minutes is null or v_minutes not between 5 and 1440 then
        perform private.agenda_fail('23514', 'reservation_quoted_minutes_required',
          'a service on quote needs its time, from 5 to 1440 minutes');
      end if;
    end if;
  end loop;
  -- Spec 024, RN-05 / RN-06: one package at most, nothing chosen twice.
  perform private.check_service_combination(p_service_ids);

  -- Spec 021: the day is always known, and locked in both branches below, so that the customer's
  -- one-a-day rule is checked with that day's bookings serialized.
  v_day := (p_slot_start at time zone 'America/Bogota')::date;

  if v_slot_changed then
    -- CA-06: one booking at a time per day.
    select * into v_day_row from public.agenda_days where day = v_day for update;
    select enabled into v_enabled from public.agenda_weeks where week_start = v_day_row.week_start;
    if v_day_row.day is null or not coalesce(v_enabled, false) then
      perform private.agenda_fail('23514', 'reservation_week_disabled', 'the week is not enabled');
    end if;
    if not v_day_row.is_open then
      perform private.agenda_fail('23514', 'reservation_day_closed', 'the day is closed');
    end if;
    select ds.slot_end into v_slot_end from private.day_slots(v_day) ds where ds.slot_start = p_slot_start;
    if v_slot_end is null then
      perform private.agenda_fail('23514', 'reservation_slot_invalid', 'that is not the start of a slot');
    end if;
    if p_slot_start <= private.agenda_now() then
      perform private.agenda_fail('23514', 'reservation_slot_started', 'the slot has already started');
    end if;
    -- CA-08, RN-03: the vehicle already has a pending reservation in this slot.
    if p_vehicle_id is not null and exists (
      select 1 from public.reservations
      where vehicle_id = p_vehicle_id and slot_start = p_slot_start and status = 'pending'
        and id is distinct from p_id
    ) then
      perform private.agenda_fail('23505', 'reservation_vehicle_taken', 'the vehicle already has a reservation in this slot');
    end if;
    select seats into v_seats from public.agenda_settings;
    if private.taken_seats(p_slot_start, v_slot_end, p_id) >= v_seats then
      perform private.agenda_fail('23514', 'reservation_slot_full', 'the slot is full');
    end if;
  else
    v_slot_end := v_reservation.slot_end;
    -- Spec 021, CA-04: changing only the vehicle may clash with that day's reservations too.
    perform 1 from public.agenda_days where day = v_day for update;
    if p_vehicle_id is not null and exists (
      select 1 from public.reservations
      where vehicle_id = p_vehicle_id and slot_start = p_slot_start and status = 'pending' and id <> p_id
    ) then
      perform private.agenda_fail('23505', 'reservation_vehicle_taken', 'the vehicle already has a reservation in this slot');
    end if;
  end if;

  -- Spec 021, RN-01 (replaces spec 014, RN-03): from the app, at most one pending reservation per
  -- vehicle a day, and one without vehicle a day. Staff keep spec 012's rule (only the same slot).
  if not v_staff and exists (
    select 1 from public.reservations
    where customer_id = v_customer_id and status = 'pending'
      and vehicle_id is not distinct from p_vehicle_id and id is distinct from p_id
      and (slot_start at time zone 'America/Bogota')::date = v_day
  ) then
    perform private.agenda_fail('23505', 'reservation_customer_limit', 'the customer already has a pending reservation for it that day');
  end if;

  if p_id is null then
    insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, notes, created_at, created_by,
                                     booked_by_customer)
    values (v_customer_id, p_vehicle_id, p_slot_start, v_slot_end, nullif(btrim(p_notes), ''),
            private.agenda_now(), case when v_staff then (select auth.uid()) end, not v_staff)
    returning id into v_id;
  else
    v_id := p_id;
    update public.reservations
       set vehicle_id = p_vehicle_id, slot_start = p_slot_start, slot_end = v_slot_end,
           notes = nullif(btrim(p_notes), ''), updated_at = private.agenda_now(),
           updated_by = case when v_staff then (select auth.uid()) end, updated_by_customer = not v_staff
     where id = p_id;
    delete from public.reservation_services where reservation_id = p_id;
  end if;

  foreach v_service_id in array coalesce(p_service_ids, '{}') loop
    if not exists (select 1 from public.reservation_services where reservation_id = v_id and service_id = v_service_id) then
      v_position := v_position + 1;
      insert into public.reservation_services (reservation_id, service_id, position, estimated_minutes)
      select v_id, v_service_id, v_position,
             case when s.on_quote then (p_service_minutes ->> v_service_id::text)::int end
      from public.services s where s.id = v_service_id;
    end if;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.save_reservation(uuid, uuid, timestamptz, uuid[], text, uuid, jsonb) from public, anon;
grant execute on function public.save_reservation(uuid, uuid, timestamptz, uuid[], text, uuid, jsonb)
  to authenticated, service_role;

-- bookable_services: never the services on quote (CA-16); a value by category offers it to motorcycles.
-- Each one says whether it is a package and everything it includes, inherited (HU-05, CA-23 to
-- CA-25): the customer cannot read the catalog. Its columns grow: dropped and created again.
drop function public.bookable_services();
create function public.bookable_services()
returns table (id uuid, name text, motorcycle boolean, car boolean, bicycle boolean, estimated_minutes smallint,
               package boolean, includes uuid[])
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.price_motorcycle is not null or s.motorcycle_prices is not null,
         s.price_car is not null, s.price_bicycle is not null, s.estimated_minutes,
         s.motorcycle_prices is not null,
         coalesce((select array_agg(c order by c) from private.service_closure(s.id) c where c <> s.id), '{}')
  from public.services s
  where s.disabled_at is null and not s.on_quote
    and ((select public.is_staff()) or private.active_customer_id() is not null)
  -- CA-28: the packages from the cheapest up (their price is never sent), then the rest by name.
  order by (select min(e.value::int) from jsonb_each_text(s.motorcycle_prices) e) nulls last, s.name;
$$;
revoke execute on function public.bookable_services() from public, anon;
grant execute on function public.bookable_services() to authenticated, service_role;

-- reservation_summaries, from its version of spec 014, with the time of its services (CA-14).
create or replace view public.reservation_summaries
with (security_invoker = true)
as
select
  r.id,
  r.number,
  r.status,
  r.customer_id,
  c.full_name as customer_name,
  c.phone as customer_phone,
  r.vehicle_id,
  v.vehicle_type,
  v.plate,
  m.name as plate_city_name,
  b.name as brand_name,
  l.name as line_name,
  r.slot_start,
  r.slot_end,
  (r.slot_start at time zone 'America/Bogota')::date as day,
  r.notes,
  r.tolerance_minutes,
  private.reservation_tolerance(r.tolerance_minutes) as effective_tolerance_minutes,
  r.slot_start + make_interval(mins => private.reservation_tolerance(r.tolerance_minutes)) as grace_until,
  r.created_at,
  private.staff_name(r.created_by) as created_by_name,
  r.updated_at,
  private.staff_name(r.updated_by) as updated_by_name,
  r.cancelled_at,
  private.staff_name(r.cancelled_by) as cancelled_by_name,
  r.cancel_reason,
  r.no_show_at,
  private.staff_name(r.no_show_by) as no_show_by_name,
  r.attended_at,
  private.staff_name(r.attended_by) as attended_by_name,
  r.work_order_id,
  o.number as work_order_number,
  coalesce(sv.service_ids, '{}') as service_ids,
  coalesce(sv.services, '{}') as services,
  -- CA-31: a pending reservation whose slot is no longer within an open day of an enabled week.
  (r.status = 'pending' and not exists (
    select 1 from public.agenda_days d
    join public.agenda_weeks w on w.week_start = d.week_start and w.enabled
    where d.day = (r.slot_start at time zone 'America/Bogota')::date and d.is_open
      and private.business_time(d.day, d.opens_at) <= r.slot_start
      and private.business_time(d.day, d.closes_at) >= r.slot_end
  )) as out_of_hours,
  -- CA-31: a pending reservation made after its slot already had all its seats.
  (r.status = 'pending' and (
    select count(*) from public.reservations e
    where e.status in ('pending', 'attended') and e.number < r.number
      and e.slot_start < r.slot_end and e.slot_end > r.slot_start
  ) >= (select seats from public.agenda_settings)) as over_capacity,
  -- HU-06, CA-38: how many times and how many minutes staff gave it to arrive.
  coalesce(ex.times, 0) as extensions,
  coalesce(ex.minutes, 0) as extended_minutes,
  -- Spec 014, CA-16 and CA-19: made, changed or cancelled by the customer from the app.
  r.booked_by_customer,
  r.updated_by_customer,
  r.cancelled_by_customer,
  -- Spec 024, CA-14: the time each service takes in this reservation (the one staff gave a service on
  -- quote, or none), the total and the services without a time, as in work_order_summaries.
  coalesce(sv.service_minutes, '{}') as service_minutes,
  coalesce(sv.estimated_minutes, 0) as estimated_minutes,
  coalesce(sv.unestimated, '{}') as unestimated
from public.reservations r
join public.customers c on c.id = r.customer_id
left join public.vehicles v on v.id = r.vehicle_id
left join public.vehicle_brands b on b.id = v.brand_id
left join public.vehicle_lines l on l.id = v.line_id
left join public.municipalities m on m.code = v.plate_city_code
left join public.work_orders o on o.id = r.work_order_id
left join lateral (
  select array_agg(rs.service_id order by rs.position) as service_ids,
         array_agg(s.name order by rs.position) as services,
         array_agg(rs.estimated_minutes order by rs.position) as service_minutes,
         sum(coalesce(rs.estimated_minutes, s.estimated_minutes))::integer as estimated_minutes,
         array_agg(s.name order by rs.position)
           filter (where coalesce(rs.estimated_minutes, s.estimated_minutes) is null) as unestimated
  from public.reservation_services rs
  join public.services s on s.id = rs.service_id
  where rs.reservation_id = r.id
) sv on true
left join lateral (
  select count(*)::integer as times, sum(e.minutes)::integer as minutes
  from public.reservation_extensions e
  where e.reservation_id = r.id
) ex on true;

revoke all on table public.reservation_summaries from anon, authenticated;
grant select on table public.reservation_summaries to authenticated;

-- Data for every environment (CA-17, CA-18) -------------------------------------------------------------------
-- The category of each motorcycle line of the initial catalog (20261119211116), by the type of motorcycle
-- its maker declares; the admin corrects it in «Marcas y líneas». A line missing (renamed or merged) is
-- skipped.
update public.vehicle_lines l
   set motorcycle_category = c.category::public.motorcycle_category
  from (
  values
    ('AKT', 'NKD 125', 'street'),
    ('AKT', 'CR4 125', 'trail'),
    ('AKT', 'CR4 162', 'trail'),
    ('AKT', 'CR5 180', 'trail'),
    ('AKT', 'TT 125', 'trail'),
    ('AKT', 'TTR 200', 'trail'),
    ('AKT', 'TT DS 200', 'trail'),
    ('AKT', 'Dynamic Pro 125', 'scooter'),
    ('AKT', 'Special 110', 'street'),
    ('AKT', 'Flex 125', 'scooter'),
    ('AKT', 'Jet 5R', 'scooter'),
    ('AKT', 'RTX 150', 'street'),
    ('Bajaj', 'Boxer CT 100', 'street'),
    ('Bajaj', 'Boxer S', 'street'),
    ('Bajaj', 'Platino 100', 'street'),
    ('Bajaj', 'Discover 125', 'street'),
    ('Bajaj', 'Pulsar NS 125', 'street'),
    ('Bajaj', 'Pulsar NS 160', 'street'),
    ('Bajaj', 'Pulsar NS 200', 'street'),
    ('Bajaj', 'Pulsar N160', 'street'),
    ('Bajaj', 'Pulsar N250', 'street'),
    ('Bajaj', 'Pulsar RS 200', 'sbk'),
    ('Bajaj', 'Dominar 250', 'street'),
    ('Bajaj', 'Dominar 400', 'street'),
    ('Honda', 'Wave 110', 'street'),
    ('Honda', 'Dio 110', 'scooter'),
    ('Honda', 'Navi 110', 'scooter'),
    ('Honda', 'CB 125F', 'street'),
    ('Honda', 'CB 160F', 'street'),
    ('Honda', 'CB 190R', 'street'),
    ('Honda', 'XR 150L', 'trail'),
    ('Honda', 'XR 190L', 'trail'),
    ('Honda', 'XRE 300', 'trail'),
    ('Honda', 'CB 300F', 'street'),
    ('Honda', 'CB 300R', 'street'),
    ('Honda', 'PCX 160', 'scooter'),
    ('Honda', 'ADV 160', 'scooter'),
    ('Honda', 'CB 650R', 'street'),
    ('Honda', 'CBR 650R', 'sbk'),
    ('Honda', 'NC 750X', 'maxi_trail'),
    ('Honda', 'Africa Twin', 'maxi_trail'),
    ('Yamaha', 'Crypton FI', 'street'),
    ('Yamaha', 'BWS FI', 'scooter'),
    ('Yamaha', 'YBR 125', 'street'),
    ('Yamaha', 'XTZ 125', 'trail'),
    ('Yamaha', 'XTZ 150', 'trail'),
    ('Yamaha', 'XTZ 250', 'trail'),
    ('Yamaha', 'FZ 150', 'street'),
    ('Yamaha', 'FZ 25', 'street'),
    ('Yamaha', 'NMAX 155', 'scooter'),
    ('Yamaha', 'XMAX 300', 'maxi_scooter'),
    ('Yamaha', 'R15', 'sbk'),
    ('Yamaha', 'R3', 'sbk'),
    ('Yamaha', 'MT-03', 'street'),
    ('Yamaha', 'MT-07', 'street'),
    ('Yamaha', 'MT-09', 'street'),
    ('Yamaha', 'R6', 'sbk'),
    ('Yamaha', 'R1', 'sbk'),
    ('Yamaha', 'Ténéré 700', 'maxi_trail'),
    ('Suzuki', 'Viva R 115', 'street'),
    ('Suzuki', 'Best 125', 'street'),
    ('Suzuki', 'AX4', 'street'),
    ('Suzuki', 'GN 125', 'street'),
    ('Suzuki', 'DR 150', 'trail'),
    ('Suzuki', 'Gixxer 150', 'street'),
    ('Suzuki', 'Gixxer 250', 'street'),
    ('Suzuki', 'GSX-S150', 'street'),
    ('Suzuki', 'GSX-R150', 'sbk'),
    ('Suzuki', 'V-Strom 250', 'trail'),
    ('Suzuki', 'V-Strom 650', 'maxi_trail'),
    ('Suzuki', 'V-Strom 800DE', 'maxi_trail'),
    ('Suzuki', 'GSX-8S', 'street'),
    ('Suzuki', 'GSX-S750', 'street'),
    ('Suzuki', 'GSX-S1000', 'street'),
    ('Suzuki', 'GSX-R600', 'sbk'),
    ('Suzuki', 'GSX-R750', 'sbk'),
    ('Suzuki', 'GSX-R1000', 'sbk'),
    ('Suzuki', 'Hayabusa', 'sbk'),
    ('Suzuki', 'Burgman Street 125', 'scooter'),
    ('TVS', 'Sport 100', 'street'),
    ('TVS', 'Raider 125', 'street'),
    ('TVS', 'NTORQ 125', 'scooter'),
    ('TVS', 'Apache RTR 160 4V', 'street'),
    ('TVS', 'Apache RTR 200 4V', 'street'),
    ('TVS', 'Apache RR 310', 'sbk'),
    ('TVS', 'Ronin 225', 'street'),
    ('Hero', 'Splendor Plus', 'street'),
    ('Hero', 'Eco Deluxe', 'street'),
    ('Hero', 'Ignitor 125', 'street'),
    ('Hero', 'Hunk 160R', 'street'),
    ('Hero', 'Xpulse 200', 'trail'),
    ('Hero', 'Xoom 110', 'scooter'),
    ('Victory', 'One', 'street'),
    ('Victory', 'Bomber 125', 'street'),
    ('Victory', 'Nitro 125', 'street'),
    ('Victory', 'MRX 150', 'trail'),
    ('Victory', 'Combat 100', 'street'),
    ('KTM', 'Duke 200', 'street'),
    ('KTM', 'Duke 250', 'street'),
    ('KTM', 'Duke 390', 'street'),
    ('KTM', 'Duke 790', 'street'),
    ('KTM', 'Duke 890', 'street'),
    ('KTM', 'RC 200', 'sbk'),
    ('KTM', 'RC 390', 'sbk'),
    ('KTM', '390 Adventure', 'trail'),
    ('KTM', '890 Adventure', 'maxi_trail'),
    ('Kawasaki', 'Ninja 400', 'sbk'),
    ('Kawasaki', 'Ninja 650', 'sbk'),
    ('Kawasaki', 'Ninja ZX-6R', 'sbk'),
    ('Kawasaki', 'Z400', 'street'),
    ('Kawasaki', 'Z650', 'street'),
    ('Kawasaki', 'Z900', 'street'),
    ('Kawasaki', 'Versys 650', 'maxi_trail'),
    ('Kawasaki', 'KLR 650', 'maxi_trail'),
    ('Kawasaki', 'Vulcan S', 'cruiser'),
    ('Royal Enfield', 'Hunter 350', 'street'),
    ('Royal Enfield', 'Classic 350', 'cruiser'),
    ('Royal Enfield', 'Meteor 350', 'cruiser'),
    ('Royal Enfield', 'Bullet 350', 'cruiser'),
    ('Royal Enfield', 'Scram 411', 'trail'),
    ('Royal Enfield', 'Himalayan 450', 'trail'),
    ('Royal Enfield', 'Interceptor 650', 'cruiser'),
    ('Royal Enfield', 'Continental GT 650', 'cruiser'),
    ('Royal Enfield', 'Super Meteor 650', 'maxi_cruiser'),
    ('BMW', 'G 310 R', 'street'),
    ('BMW', 'G 310 GS', 'trail'),
    ('BMW', 'F 800 GS', 'maxi_trail'),
    ('BMW', 'F 900 R', 'street'),
    ('BMW', 'F 900 GS', 'maxi_trail'),
    ('BMW', 'R 1250 GS', 'maxi_trail'),
    ('BMW', 'R 1300 GS', 'maxi_trail'),
    ('BMW', 'S 1000 RR', 'sbk'),
    ('Ducati', 'Monster', 'street'),
    ('Ducati', 'Scrambler Icon', 'cruiser'),
    ('Ducati', 'Panigale V2', 'sbk'),
    ('Ducati', 'Panigale V4', 'sbk'),
    ('Ducati', 'Multistrada V2', 'maxi_trail'),
    ('Ducati', 'Multistrada V4', 'maxi_trail'),
    ('Ducati', 'Diavel', 'maxi_cruiser'),
    ('Harley-Davidson', 'Iron 883', 'cruiser'),
    ('Harley-Davidson', 'Sportster S', 'maxi_cruiser'),
    ('Harley-Davidson', 'Nightster', 'cruiser'),
    ('Harley-Davidson', 'Fat Boy', 'maxi_cruiser'),
    ('Harley-Davidson', 'Street Glide', 'maxi_cruiser'),
    ('Harley-Davidson', 'Pan America', 'maxi_trail'),
    ('Triumph', 'Speed 400', 'street'),
    ('Triumph', 'Scrambler 400 X', 'cruiser'),
    ('Triumph', 'Trident 660', 'street'),
    ('Triumph', 'Street Triple', 'street'),
    ('Triumph', 'Tiger 900', 'maxi_trail'),
    ('Triumph', 'Bonneville T120', 'cruiser'),
    ('Benelli', 'TNT 135', 'street'),
    ('Benelli', '180S', 'street'),
    ('Benelli', '302S', 'street'),
    ('Benelli', 'Leoncino 500', 'cruiser'),
    ('Benelli', 'TRK 502', 'maxi_trail'),
    ('Benelli', 'Imperiale 400', 'cruiser'),
    ('CFMoto', '300NK', 'street'),
    ('CFMoto', '450NK', 'street'),
    ('CFMoto', '650NK', 'street'),
    ('CFMoto', '450SR', 'sbk'),
    ('CFMoto', '450MT', 'trail'),
    ('CFMoto', '800MT', 'maxi_trail'),
    ('Voge', '300R', 'street'),
    ('Voge', '300 Rally', 'trail'),
    ('Voge', '500DS', 'trail'),
    ('Voge', '525DSX', 'maxi_trail'),
    ('Kymco', 'Agility 125', 'scooter'),
    ('Kymco', 'Like 125', 'scooter'),
    ('Kymco', 'AK 550', 'maxi_scooter'),
    ('Vespa', 'Primavera 150', 'scooter'),
    ('Vespa', 'Sprint 150', 'scooter'),
    ('Vespa', 'GTS 300', 'maxi_scooter')
  ) as c(brand, line, category)
  join public.vehicle_brands b on b.vehicle_type = 'motorcycle' and b.name = c.brand
 where l.brand_id = b.id and l.name = c.line and l.motorcycle_category is null;

-- The business's price list (images of 2026-11-26), loaded once: the admin changes it in «Servicios». A
-- service the admin already has with the same name is left as it is.
-- (services_guard refuses a repeated name with an error before inserting, so «on conflict» would not
-- catch it: the ones already there are filtered out instead.)
insert into public.services (name, motorcycle_prices, price_motorcycle, on_quote, estimated_minutes, description)
select l.name, l.prices::jsonb, l.single, l.on_quote, l.minutes, l.description
from (
values
  ('Lavado Pro Wash',
   '{"street": 44000, "sbk": 46000, "scooter": 42000, "maxi_scooter": 46000, "trail": 48000, "maxi_trail": 52000, "cruiser": 44000, "maxi_cruiser": 48000}',
   null, false, null,
   'Shampoo alcalino en las partes bajas y de pH neutro en las zonas altas; sellador en las zonas negras, con protección e hidrorrepelencia.'),
  ('Paquete de lavado Premium',
   '{"street": 99000, "sbk": 101000, "scooter": 97000, "maxi_scooter": 101000, "trail": 103000, "maxi_trail": 107000, "cruiser": 99000, "maxi_cruiser": 103000}',
   null, false, 120,
   'Lavado Pro Wash, limpieza completa de kit incluida tapa piñón, sellador acrílico y limpieza de asientos.'),
  ('Combo de lavado Deluxe',
   '{"street": 170000, "sbk": 182000, "scooter": 178000, "maxi_scooter": 180000, "trail": 175000, "maxi_trail": 182000, "cruiser": 170000, "maxi_cruiser": 180000}',
   null, false, 210,
   'Lavado Pro Wash, desengrasado y lubricado de cadena y micropulido al 60 % en pintura brillante. No aplica a pintura mate.'),
  ('Combo de lavado Supreme',
   '{"street": 700000, "sbk": 850000, "scooter": 750000, "maxi_scooter": 800000, "trail": 830000, "maxi_trail": 900000, "cruiser": 700000, "maxi_cruiser": 750000}',
   null, false, null,
   'Lavado Pro Wash, limpieza completa de kit incluida tapa piñón, limpieza de asientos, micropulido al 90 % y recubrimiento cerámico por 3 años. Unos 2 días hábiles; no protege de rayones.'),
  ('Limpieza de asientos', null, 16000, false, null,
   'Se retiran los asientos para limpiar la zona e hidratar el cuero.'),
  ('Sellador', null, 15000, false, null,
   'Sellador acrílico sobre pintura mate o brillante: protección e hidrorrepelencia.'),
  ('Desengrasado de cadena', null, 7000, false, null, null),
  ('Lubricado de cadena', null, 9000, false, null, null),
  ('Desengrasado y lubricado de cadena', null, 16000, false, null, null),
  ('Limpieza completa de kit con tapa piñón', null, 26000, false, null, null),
  ('Limpieza completa de kit con tapa piñón y cubrecadena', null, 46000, false, null, null),
  ('PPF', null, null, true, null,
   'Película de protección de pintura: valor y tiempo según el vehículo, acordados al recibirlo.')
) as l(name, prices, single, on_quote, minutes, description)
where not exists (select 1 from public.services s where s.name_key = private.service_name_key(l.name));

-- What the packages of the list include (CA-22), by name; a pair already there is kept. «Kit» is the
-- chain kit: cleaning it includes degreasing and lubricating the chain. What is not sold apart
-- (micropulido, recubrimiento cerámico) stays in the description.
insert into public.service_inclusions (service_id, included_id)
select s.id, i.id
from (values
  ('Paquete de lavado Premium', 'Lavado Pro Wash'),
  ('Paquete de lavado Premium', 'Limpieza completa de kit con tapa piñón'),
  ('Paquete de lavado Premium', 'Sellador'),
  ('Paquete de lavado Premium', 'Limpieza de asientos'),
  ('Combo de lavado Deluxe', 'Lavado Pro Wash'),
  ('Combo de lavado Deluxe', 'Desengrasado y lubricado de cadena'),
  ('Combo de lavado Supreme', 'Lavado Pro Wash'),
  ('Combo de lavado Supreme', 'Limpieza completa de kit con tapa piñón'),
  ('Combo de lavado Supreme', 'Limpieza de asientos'),
  ('Limpieza completa de kit con tapa piñón', 'Desengrasado y lubricado de cadena'),
  ('Limpieza completa de kit con tapa piñón y cubrecadena', 'Limpieza completa de kit con tapa piñón'),
  ('Desengrasado y lubricado de cadena', 'Desengrasado de cadena'),
  ('Desengrasado y lubricado de cadena', 'Lubricado de cadena')
) as l (service, included)
join public.services s on s.name_key = private.service_name_key(l.service)
join public.services i on i.name_key = private.service_name_key(l.included)
on conflict do nothing;
