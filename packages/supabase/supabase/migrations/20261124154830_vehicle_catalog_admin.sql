-- Spec 018 — the admin manages the vehicle brands and lines catalog (spec 005 only preloads it and
-- lets it grow when someone types a really new name):
--
-- * Review (RF-02, RN-07): each brand and line knows whether it is reviewed (the initial load, and
--   whatever the admin registers, renames, marks or keeps when merging or moving) or still to review
--   (typed by someone registering a vehicle; its created_at is when). Only the admin reads either
--   (RN-06): column privileges keep them out of the API.
-- * Remembered names (RF-03, CA-16): a merged name, or the one before a rename, resolves to the one
--   that stayed when someone types it again, so it is never created twice.
-- * Register, rename, mark reviewed, merge and move a line: admin only, security definer, one
--   transaction each. Merging and
--   moving pass every vehicle, retired ones too: the guard lets only their brand and line change,
--   and only while one of these functions runs (`motorismo.recataloging`).
--
-- seeds: 08_vehicle_catalog.sql adds, in local only, an «added» brand with a typo to review.

-- Review (RF-02, RN-07) -------------------------------------------------------------------------------
-- A new row (typed by someone registering a vehicle, spec 005) is to review; the admin's functions
-- below mark what they register or correct as reviewed.
alter table public.vehicle_brands add column reviewed boolean not null default false;
alter table public.vehicle_lines add column reviewed boolean not null default false;

comment on column public.vehicle_brands.reviewed is
  'Spec 018, RN-07: initial load or checked by the admin; false while to review (typed registering a vehicle, created_at).';
comment on column public.vehicle_lines.reviewed is
  'Spec 018, RN-07: initial load or checked by the admin; false while to review (typed registering a vehicle, created_at).';

-- The initial load (migration vehicle_catalog_data) was one transaction, so its rows share one
-- created_at, the earliest of the catalog: no row added later by save_vehicle can have it. Marks the
-- brands and lines of that moment as reviewed and every other one as to review.
create function private.mark_initial_vehicle_catalog_reviewed()
returns void
language sql
set search_path = ''
as $$
  update public.vehicle_brands b
  set reviewed = (b.created_at = f.first)
  from (select min(created_at) as first from public.vehicle_brands) f;
  update public.vehicle_lines l
  set reviewed = (l.created_at = f.first)
  from (select min(created_at) as first from public.vehicle_brands) f;
$$;

revoke all on function private.mark_initial_vehicle_catalog_reviewed() from public;

select private.mark_initial_vehicle_catalog_reviewed();

-- Remembered names (RF-03) --------------------------------------------------------------------------
-- A name a brand of the type had (merged into it, or before a rename). Never equal to a live brand
-- of the type (RN-02): the functions below keep that.
create table public.vehicle_brand_aliases (
  id uuid primary key default gen_random_uuid(),
  vehicle_type public.vehicle_type not null,
  brand_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  name_key text not null generated always as (private.catalog_key(name)) stored,
  created_at timestamptz not null default now(),
  constraint vehicle_brand_aliases_type_key_key unique (vehicle_type, name_key),
  constraint vehicle_brand_aliases_brand_fk foreign key (brand_id, vehicle_type)
    references public.vehicle_brands (id, vehicle_type) on delete cascade
);

create index vehicle_brand_aliases_brand_idx on public.vehicle_brand_aliases (brand_id);

comment on table public.vehicle_brand_aliases is
  'Spec 018, CA-16: names a brand had (merged or renamed); typed again, they resolve to the brand.';

-- The same for the lines of a brand. When a line moves to another brand, its names go with it.
create table public.vehicle_line_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null,
  line_id uuid not null,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 60),
  name_key text not null generated always as (private.catalog_key(name)) stored,
  created_at timestamptz not null default now(),
  constraint vehicle_line_aliases_brand_key_key unique (brand_id, name_key),
  constraint vehicle_line_aliases_line_fk foreign key (line_id, brand_id)
    references public.vehicle_lines (id, brand_id) on update cascade on delete cascade
);

create index vehicle_line_aliases_line_idx on public.vehicle_line_aliases (line_id);

comment on table public.vehicle_line_aliases is
  'Spec 018, CA-16: names a line had (merged or renamed); typed again, they resolve to the line.';

-- HU-04: a line moves to another brand with its vehicles in one transaction; the key from a vehicle
-- to its line (and brand) is checked at the end of the move, not in between.
alter table public.vehicles alter constraint vehicles_line_fk deferrable initially immediate;

-- RLS and privileges (RN-01, RN-06, CA-06) -----------------------------------------------------------
-- The catalog is still read by everyone (suggestions), but not whether it is reviewed nor when it was
-- added.
revoke select on table public.vehicle_brands, public.vehicle_lines from authenticated;
grant select (id, vehicle_type, name, name_key) on table public.vehicle_brands to authenticated;
grant select (id, brand_id, name, name_key) on table public.vehicle_lines to authenticated;

alter table public.vehicle_brand_aliases enable row level security;
alter table public.vehicle_line_aliases enable row level security;

create policy vehicle_brand_aliases_select_authenticated on public.vehicle_brand_aliases
  for select to authenticated using (true);
create policy vehicle_line_aliases_select_authenticated on public.vehicle_line_aliases
  for select to authenticated using (true);

-- Read with their brand or line (the suggestions embed them); written only by the functions below.
revoke all on table public.vehicle_brand_aliases, public.vehicle_line_aliases from anon, authenticated;
grant select (vehicle_type, brand_id, name) on table public.vehicle_brand_aliases to authenticated;
grant select (brand_id, line_id, name) on table public.vehicle_line_aliases to authenticated;

-- vehicles_guard, as in spec 017, with the exception of recataloging ----------------------------------
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
$function$;

-- Resolving names (CA-16) ---------------------------------------------------------------------------
-- As in spec 005, but a remembered name gives the brand it belongs to before anything is added.
create or replace function private.ensure_vehicle_brand(p_type public.vehicle_type, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
  v_key text := private.catalog_key(v_name);
  v_id uuid;
begin
  if v_name = '' then
    raise exception 'the brand is required'
      using errcode = 'check_violation', hint = 'vehicle_brand_required';
  end if;

  select b.id into v_id from public.vehicle_brands b
  where b.vehicle_type = p_type and b.name_key = v_key;
  if v_id is null then
    select a.brand_id into v_id from public.vehicle_brand_aliases a
    where a.vehicle_type = p_type and a.name_key = v_key;
  end if;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.vehicle_brands (vehicle_type, name) values (p_type, v_name)
  on conflict (vehicle_type, name_key) do nothing
  returning id into v_id;

  if v_id is null then
    select b.id into v_id from public.vehicle_brands b
    where b.vehicle_type = p_type and b.name_key = v_key;
  end if;
  return v_id;
end;
$$;

create or replace function private.ensure_vehicle_line(p_brand_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
  v_key text := private.catalog_key(v_name);
  v_id uuid;
begin
  if v_name = '' then
    return null;
  end if;

  select l.id into v_id from public.vehicle_lines l
  where l.brand_id = p_brand_id and l.name_key = v_key;
  if v_id is null then
    select a.line_id into v_id from public.vehicle_line_aliases a
    where a.brand_id = p_brand_id and a.name_key = v_key;
  end if;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.vehicle_lines (brand_id, name) values (p_brand_id, v_name)
  on conflict (brand_id, name_key) do nothing
  returning id into v_id;

  if v_id is null then
    select l.id into v_id from public.vehicle_lines l
    where l.brand_id = p_brand_id and l.name_key = v_key;
  end if;
  return v_id;
end;
$$;

-- Helpers of the admin's functions -------------------------------------------------------------------
create function private.require_admin_for_vehicle_catalog()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'only an admin manages the vehicle catalog'
      using errcode = '42501', hint = 'catalog_admin_only';
  end if;
end;
$$;

-- A name as the catalog keeps it (trimmed, single spaces), or the reason it is refused (CA-10).
create function private.catalog_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[[:space:]]+', ' ', 'g'));
begin
  if v_name = '' then
    raise exception 'the name is required' using errcode = 'check_violation', hint = 'catalog_name_required';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'the name is too long' using errcode = 'check_violation', hint = 'catalog_name_too_long';
  end if;
  return v_name;
end;
$$;

-- One line takes another one's place: its vehicles (with the brand of the line that stays), its
-- remembered names and, if it was written differently, its name. The absorbed line is deleted.
-- Called with recataloging on (the vehicles may be retired).
create function private.absorb_vehicle_line(p_from uuid, p_into uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_from public.vehicle_lines;
  v_into public.vehicle_lines;
begin
  select * into v_from from public.vehicle_lines where id = p_from;
  select * into v_into from public.vehicle_lines where id = p_into;

  update public.vehicles set line_id = p_into, brand_id = v_into.brand_id where line_id = p_from;

  -- RN-02: a remembered name that the brand that stays already has (live or remembered) is not kept.
  delete from public.vehicle_line_aliases a
  where a.line_id = p_from
    and (exists (select 1 from public.vehicle_lines l where l.brand_id = v_into.brand_id and l.name_key = a.name_key)
         or exists (select 1 from public.vehicle_line_aliases b where b.brand_id = v_into.brand_id and b.name_key = a.name_key));
  update public.vehicle_line_aliases set line_id = p_into, brand_id = v_into.brand_id where line_id = p_from;

  delete from public.vehicle_lines where id = p_from;

  if v_from.name_key <> v_into.name_key then
    insert into public.vehicle_line_aliases (brand_id, line_id, name)
    values (v_into.brand_id, p_into, v_from.name)
    on conflict (brand_id, name_key) do nothing;
  end if;
end;
$$;

-- A line goes to another brand (of its type) as it is, with its vehicles and its remembered names
-- (those the new brand already has are not kept). Called with recataloging on.
create function private.relocate_vehicle_line(p_line uuid, p_brand uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.vehicle_line_aliases a
  where a.line_id = p_line
    and (exists (select 1 from public.vehicle_lines l where l.brand_id = p_brand and l.name_key = a.name_key)
         or exists (select 1 from public.vehicle_line_aliases b where b.brand_id = p_brand and b.name_key = a.name_key));

  set constraints public.vehicles_line_fk deferred;
  update public.vehicle_lines set brand_id = p_brand where id = p_line;
  update public.vehicles set brand_id = p_brand where line_id = p_line;
  set constraints public.vehicles_line_fk immediate;
end;
$$;

revoke all on function private.require_admin_for_vehicle_catalog(), private.catalog_name(text),
  private.absorb_vehicle_line(uuid, uuid), private.relocate_vehicle_line(uuid, uuid) from public;

-- The admin's reading (CA-01 to CA-03) ---------------------------------------------------------------
-- The brands of a type in alphabetical order, each with whether it is reviewed, when it was added, how many
-- vehicles use it (active and retired) and its lines with the same data.
create function public.vehicle_catalog(p_type public.vehicle_type)
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
                    'vehicles', (select count(*) from public.vehicles v where v.line_id = l.id))
                  order by l.name_key, l.name)
           from public.vehicle_lines l
           where l.brand_id = b.id
         ), '[]'::jsonb)
  from public.vehicle_brands b
  where b.vehicle_type = p_type
  order by b.name_key, b.name;
end;
$$;

-- Rename (HU-02) -------------------------------------------------------------------------------------
-- The name another brand of the type has, or remembers, is refused (CA-09): if they are the same,
-- they are merged. The old name is remembered (CA-16) and the brand is reviewed (CA-11, RN-07).
create function public.rename_vehicle_brand(p_brand_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand public.vehicle_brands;
  v_name text;
  v_key text;
begin
  perform private.require_admin_for_vehicle_catalog();
  v_name := private.catalog_name(p_name);
  v_key := private.catalog_key(v_name);

  select * into v_brand from public.vehicle_brands where id = p_brand_id for update;
  if not found then
    raise exception 'brand not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;

  if exists (select 1 from public.vehicle_brands b
             where b.vehicle_type = v_brand.vehicle_type and b.name_key = v_key and b.id <> p_brand_id)
     or exists (select 1 from public.vehicle_brand_aliases a
                where a.vehicle_type = v_brand.vehicle_type and a.name_key = v_key and a.brand_id <> p_brand_id) then
    raise exception 'another brand has that name' using errcode = 'unique_violation', hint = 'catalog_name_taken';
  end if;

  -- One of its own old names becomes its name again: no longer only remembered.
  delete from public.vehicle_brand_aliases a
  where a.vehicle_type = v_brand.vehicle_type and a.name_key = v_key;
  if v_key <> v_brand.name_key then
    insert into public.vehicle_brand_aliases (vehicle_type, brand_id, name)
    values (v_brand.vehicle_type, p_brand_id, v_brand.name);
  end if;

  update public.vehicle_brands set name = v_name, reviewed = true where id = p_brand_id;
end;
$$;

create function public.rename_vehicle_line(p_line_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.vehicle_lines;
  v_name text;
  v_key text;
begin
  perform private.require_admin_for_vehicle_catalog();
  v_name := private.catalog_name(p_name);
  v_key := private.catalog_key(v_name);

  select * into v_line from public.vehicle_lines where id = p_line_id for update;
  if not found then
    raise exception 'line not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;

  if exists (select 1 from public.vehicle_lines l
             where l.brand_id = v_line.brand_id and l.name_key = v_key and l.id <> p_line_id)
     or exists (select 1 from public.vehicle_line_aliases a
                where a.brand_id = v_line.brand_id and a.name_key = v_key and a.line_id <> p_line_id) then
    raise exception 'another line of the brand has that name' using errcode = 'unique_violation', hint = 'catalog_name_taken';
  end if;

  delete from public.vehicle_line_aliases a where a.brand_id = v_line.brand_id and a.name_key = v_key;
  if v_key <> v_line.name_key then
    insert into public.vehicle_line_aliases (brand_id, line_id, name)
    values (v_line.brand_id, p_line_id, v_line.name);
  end if;

  update public.vehicle_lines set name = v_name, reviewed = true where id = p_line_id;
end;
$$;

-- Merge brands (HU-03) -------------------------------------------------------------------------------
-- Every vehicle of p_from goes to p_into (retired ones too). Each line of p_from merges with the
-- equal one of p_into or moves to it (CA-13). p_from disappears and its name is remembered for
-- p_into (CA-16). Returns how many vehicles passed (CA-12).
create function public.merge_vehicle_brands(p_from uuid, p_into uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.vehicle_brands;
  v_into public.vehicle_brands;
  v_count integer;
  v_line public.vehicle_lines;
  v_equal uuid;
begin
  perform private.require_admin_for_vehicle_catalog();
  if p_from = p_into then
    raise exception 'a brand cannot merge with itself' using errcode = 'check_violation', hint = 'catalog_same_item';
  end if;

  select * into v_from from public.vehicle_brands where id = p_from for update;
  select * into v_into from public.vehicle_brands where id = p_into for update;
  if v_from.id is null or v_into.id is null then
    raise exception 'brand not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;
  if v_from.vehicle_type <> v_into.vehicle_type then
    raise exception 'brands of different types' using errcode = 'check_violation', hint = 'catalog_type_mismatch';
  end if;

  select count(*)::integer into v_count from public.vehicles where brand_id = p_from;
  perform set_config('motorismo.recataloging', 'on', true);

  for v_line in select * from public.vehicle_lines where brand_id = p_from order by name_key for update loop
    select l.id into v_equal from public.vehicle_lines l
    where l.brand_id = p_into and l.name_key = v_line.name_key;
    if v_equal is null then
      perform private.relocate_vehicle_line(v_line.id, p_into);
    else
      perform private.absorb_vehicle_line(v_line.id, v_equal);
    end if;
  end loop;

  -- What is left has no line (a bicycle's is optional).
  update public.vehicles set brand_id = p_into where brand_id = p_from;

  update public.vehicle_brand_aliases set brand_id = p_into where brand_id = p_from;
  delete from public.vehicle_brands where id = p_from;
  -- RN-07: the brand that stays is reviewed; the lines that passed keep their state.
  update public.vehicle_brands set reviewed = true where id = p_into;
  insert into public.vehicle_brand_aliases (vehicle_type, brand_id, name)
  values (v_from.vehicle_type, p_into, v_from.name)
  on conflict (vehicle_type, name_key) do nothing;

  perform set_config('motorismo.recataloging', 'off', true);
  return v_count;
end;
$$;

-- Merge lines of a brand (HU-03, CA-14) ----------------------------------------------------------------
create function public.merge_vehicle_lines(p_from uuid, p_into uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from public.vehicle_lines;
  v_into public.vehicle_lines;
  v_count integer;
begin
  perform private.require_admin_for_vehicle_catalog();
  if p_from = p_into then
    raise exception 'a line cannot merge with itself' using errcode = 'check_violation', hint = 'catalog_same_item';
  end if;

  select * into v_from from public.vehicle_lines where id = p_from for update;
  select * into v_into from public.vehicle_lines where id = p_into for update;
  if v_from.id is null or v_into.id is null then
    raise exception 'line not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;
  if v_from.brand_id <> v_into.brand_id then
    raise exception 'lines of different brands' using errcode = 'check_violation', hint = 'catalog_brand_mismatch';
  end if;

  select count(*)::integer into v_count from public.vehicles where line_id = p_from;
  perform set_config('motorismo.recataloging', 'on', true);
  perform private.absorb_vehicle_line(p_from, p_into);
  update public.vehicle_lines set reviewed = true where id = p_into; -- RN-07: the one that stays.
  perform set_config('motorismo.recataloging', 'off', true);
  return v_count;
end;
$$;

-- Move a line to another brand (HU-04) ---------------------------------------------------------------
-- With its vehicles, which take the new brand (CA-18); merged with an equal line there (CA-19). Only
-- to another brand of its type (CA-20).
create function public.move_vehicle_line(p_line_id uuid, p_brand_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line public.vehicle_lines;
  v_brand public.vehicle_brands;
  v_type public.vehicle_type;
  v_count integer;
  v_equal uuid;
begin
  perform private.require_admin_for_vehicle_catalog();

  select * into v_line from public.vehicle_lines where id = p_line_id for update;
  select * into v_brand from public.vehicle_brands where id = p_brand_id for update;
  if v_line.id is null or v_brand.id is null then
    raise exception 'line or brand not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;
  if v_line.brand_id = p_brand_id then
    raise exception 'the line is already of that brand' using errcode = 'check_violation', hint = 'catalog_same_item';
  end if;
  select vehicle_type into v_type from public.vehicle_brands where id = v_line.brand_id;
  if v_type <> v_brand.vehicle_type then
    raise exception 'brands of different types' using errcode = 'check_violation', hint = 'catalog_type_mismatch';
  end if;

  select count(*)::integer into v_count from public.vehicles where line_id = p_line_id;
  perform set_config('motorismo.recataloging', 'on', true);

  select l.id into v_equal from public.vehicle_lines l
  where l.brand_id = p_brand_id and l.name_key = v_line.name_key;
  if v_equal is null then
    perform private.relocate_vehicle_line(p_line_id, p_brand_id);
  else
    perform private.absorb_vehicle_line(p_line_id, v_equal);
  end if;
  -- RN-07: the line that stays in the brand chosen is reviewed.
  update public.vehicle_lines set reviewed = true where id = coalesce(v_equal, p_line_id);

  perform set_config('motorismo.recataloging', 'off', true);
  return v_count;
end;
$$;

-- Register what is missing (HU-06, CA-26 to CA-28) ---------------------------------------------------------
-- A brand of a type, or a line of a brand, reviewed from the start (RN-07). A name another one has or
-- remembers is refused, as when renaming.
create function public.add_vehicle_brand(p_type public.vehicle_type, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_key text;
  v_id uuid;
begin
  perform private.require_admin_for_vehicle_catalog();
  v_name := private.catalog_name(p_name);
  v_key := private.catalog_key(v_name);

  if exists (select 1 from public.vehicle_brands b where b.vehicle_type = p_type and b.name_key = v_key)
     or exists (select 1 from public.vehicle_brand_aliases a where a.vehicle_type = p_type and a.name_key = v_key) then
    raise exception 'a brand of the type has that name' using errcode = 'unique_violation', hint = 'catalog_name_taken';
  end if;

  insert into public.vehicle_brands (vehicle_type, name, reviewed) values (p_type, v_name, true)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.add_vehicle_line(p_brand_id uuid, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_key text;
  v_id uuid;
begin
  perform private.require_admin_for_vehicle_catalog();
  v_name := private.catalog_name(p_name);
  v_key := private.catalog_key(v_name);

  if not exists (select 1 from public.vehicle_brands where id = p_brand_id) then
    raise exception 'brand not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;
  if exists (select 1 from public.vehicle_lines l where l.brand_id = p_brand_id and l.name_key = v_key)
     or exists (select 1 from public.vehicle_line_aliases a where a.brand_id = p_brand_id and a.name_key = v_key) then
    raise exception 'a line of the brand has that name' using errcode = 'unique_violation', hint = 'catalog_name_taken';
  end if;

  insert into public.vehicle_lines (brand_id, name, reviewed) values (p_brand_id, v_name, true)
  returning id into v_id;
  return v_id;
end;
$$;

-- Mark reviewed (HU-06, CA-29) ---------------------------------------------------------------------------
-- A brand or line someone typed that is well written: no longer to review.
create function public.mark_vehicle_brand_reviewed(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_vehicle_catalog();
  update public.vehicle_brands set reviewed = true where id = p_brand_id;
  if not found then
    raise exception 'brand not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;
end;
$$;

create function public.mark_vehicle_line_reviewed(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_vehicle_catalog();
  update public.vehicle_lines set reviewed = true where id = p_line_id;
  if not found then
    raise exception 'line not found' using errcode = 'no_data_found', hint = 'catalog_not_found';
  end if;
end;
$$;

revoke all on function public.add_vehicle_brand(public.vehicle_type, text), public.add_vehicle_line(uuid, text),
  public.mark_vehicle_brand_reviewed(uuid), public.mark_vehicle_line_reviewed(uuid) from public, anon;
grant execute on function public.add_vehicle_brand(public.vehicle_type, text), public.add_vehicle_line(uuid, text),
  public.mark_vehicle_brand_reviewed(uuid), public.mark_vehicle_line_reviewed(uuid) to authenticated, service_role;

revoke all on function public.vehicle_catalog(public.vehicle_type), public.rename_vehicle_brand(uuid, text),
  public.rename_vehicle_line(uuid, text), public.merge_vehicle_brands(uuid, uuid),
  public.merge_vehicle_lines(uuid, uuid), public.move_vehicle_line(uuid, uuid) from public, anon;
grant execute on function public.vehicle_catalog(public.vehicle_type), public.rename_vehicle_brand(uuid, text),
  public.rename_vehicle_line(uuid, text), public.merge_vehicle_brands(uuid, uuid),
  public.merge_vehicle_lines(uuid, uuid), public.move_vehicle_line(uuid, uuid) to authenticated, service_role;
