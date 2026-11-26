-- The plate as the Colombian norm draws it, and the cities that issue plates (spec 023).
--
-- * municipalities.issues_plates: the municipalities with a transit authority (organismo de
--   tránsito) in the RUNT's list, the only ones whose name a car plate carries (RN-04). Data that
--   every environment needs: set here, not in a seed.
-- * municipalities.plate_legend: what a car plate says under its characters when the admin gave the
--   municipality its own legend («STFE DE BOGOTA»); null shows the name (RN-05). Capitals without
--   accents and at most 17 characters, what fits inside the frame with the norm's letters (17 · n − 5 mm).
-- * set_plate_legend: the admin sets or clears it (CA-10); nobody else (CA-11).
-- * vehicles_guard: a plate city chosen or changed must issue plates; a car registered before with
--   another city keeps it (CA-08).
-- * work_order_summaries: plate_city_legend next to plate_city_name.
--
-- seeds: unchanged — the seeds' plate cities (Bogotá, D.C. and Medellín) issue plates.

alter table public.municipalities
  add column issues_plates boolean not null default false,
  add column plate_legend text,
  add constraint municipalities_plate_legend_format
    check (plate_legend is null or plate_legend ~ '^[A-ZÑ0-9 .,-]{1,17}$');

comment on column public.municipalities.issues_plates is
  'It has a transit authority (RUNT list) and so issues plates (spec 023, RN-04).';
comment on column public.municipalities.plate_legend is
  'What a car plate of this municipality says, when the admin set one (spec 023, RN-05).';

-- RN-04: the municipalities of the RUNT's list of transit authorities («Listado Extensiones IP –
-- Organismos de Tránsito RUNT 2.0»): 297 rows, 294 municipalities (Cajicá, Pupiales and Villagarzón
-- appear twice), matched by department and name to their DANE code.
update public.municipalities set issues_plates = true where code in (
  '05001', '05031', '05034', '05042', '05045', '05079', '05088', '05101', '05129', '05147', '05148', '05154',
  '05172', '05212', '05237', '05250', '05266', '05284', '05308', '05318', '05360', '05376', '05380', '05440',
  '05490', '05579', '05591', '05615', '05631', '05656', '05686', '05697', '05736', '05756', '05837', '05847',
  '05887', '08001', '08078', '08296', '08433', '08573', '08634', '08638', '08758', '11001', '13001', '13052',
  '13222', '13244', '13430', '13468', '13657', '13673', '13683', '13688', '13836', '15001', '15176', '15204',
  '15238', '15299', '15322', '15407', '15455', '15469', '15491', '15516', '15572', '15599', '15632', '15693',
  '15753', '15759', '17001', '17013', '17042', '17050', '17174', '17380', '17433', '17486', '17614', '17653',
  '17777', '17873', '17877', '18001', '18094', '18256', '18753', '19001', '19100', '19142', '19256', '19455',
  '19532', '19548', '19573', '19698', '19807', '19845', '20001', '20011', '20013', '20060', '20228', '20250',
  '20400', '20621', '20710', '20750', '20770', '23001', '23162', '23182', '23350', '23417', '23555', '23660',
  '25053', '25126', '25151', '25175', '25178', '25183', '25214', '25260', '25269', '25286', '25290', '25307',
  '25320', '25377', '25386', '25430', '25473', '25513', '25572', '25612', '25740', '25743', '25754', '25758',
  '25799', '25843', '25875', '25899', '27001', '27361', '41001', '41016', '41298', '41319', '41396', '41524',
  '41551', '41615', '41807', '44001', '44035', '44279', '44378', '44430', '47001', '47053', '47189', '47245',
  '47288', '47555', '47745', '47980', '50001', '50006', '50313', '50318', '50573', '50606', '52001', '52110',
  '52240', '52317', '52354', '52356', '52399', '52480', '52585', '52612', '52678', '52683', '52786', '52788',
  '52835', '52838', '52885', '54001', '54206', '54261', '54405', '54498', '54518', '54874', '63001', '63130',
  '63190', '63401', '63594', '66001', '66170', '66400', '66682', '68001', '68077', '68079', '68081', '68167',
  '68190', '68276', '68307', '68406', '68432', '68500', '68547', '68572', '68655', '68679', '68689', '68755',
  '68861', '70001', '70215', '70670', '70713', '70742', '73001', '73026', '73055', '73168', '73268', '73283',
  '73319', '73349', '73411', '73443', '73449', '73504', '73555', '73585', '76001', '76020', '76036', '76041',
  '76100', '76109', '76111', '76113', '76122', '76130', '76147', '76233', '76248', '76275', '76306', '76318',
  '76364', '76377', '76400', '76520', '76563', '76622', '76736', '76834', '76869', '76890', '76892', '76895',
  '81001', '81065', '81736', '81794', '85001', '85010', '85440', '86001', '86320', '86568', '86749', '86865',
  '86885', '88001', '91001', '94001', '95001', '99001'
);

-- set_plate_legend (CA-10, CA-11) ------------------------------------------------------------------
create function public.set_plate_legend(p_code text, p_legend text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_legend text := nullif(btrim(p_legend), '');
begin
  if not (select public.is_admin()) then
    raise exception 'only an admin sets a plate legend'
      using errcode = 'insufficient_privilege', hint = 'plate_admin_only';
  end if;
  if not exists (select 1 from public.municipalities where code = p_code and issues_plates) then
    raise exception 'the municipality issues no plates: %', p_code
      using errcode = 'check_violation', hint = 'plate_city_not_issuing';
  end if;
  if v_legend is not null and v_legend !~ '^[A-ZÑ0-9 .,-]{1,17}$' then
    raise exception 'invalid plate legend: %', v_legend
      using errcode = 'check_violation', hint = 'plate_legend_invalid';
  end if;
  update public.municipalities set plate_legend = v_legend where code = p_code;
end;
$$;

revoke execute on function public.set_plate_legend(text, text) from public, anon;
grant execute on function public.set_plate_legend(text, text) to authenticated, service_role;

-- vehicles_guard (spec 005; spec 018; spec 023, RN-04) -----------------------------------------------
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

-- work_order_summaries (spec 008; spec 023, HU-03) ------------------------------------------------------
create or replace view public.work_order_summaries
with (security_invoker = true)
as
select
  o.id,
  o.number,
  o.status,
  o.customer_id,
  c.full_name as customer_name,
  o.vehicle_id,
  v.vehicle_type,
  v.plate,
  m.name as plate_city_name,
  b.name as brand_name,
  l.name as line_name,
  o.notes,
  o.opened_at,
  private.staff_name(o.opened_by) as opened_by_name,
  o.started_at,
  private.staff_name(o.started_by) as started_by_name,
  o.closed_at,
  private.staff_name(o.closed_by) as closed_by_name,
  o.voided_at,
  private.staff_name(o.voided_by) as voided_by_name,
  o.void_reason,
  o.corrected_at,
  private.staff_name(o.corrected_by) as corrected_by_name,
  o.correction_reason,
  coalesce(t.subtotal, 0) as subtotal,
  o.discount,
  coalesce(t.subtotal, 0) - o.discount as total,
  coalesce(t.estimated_minutes, 0) as estimated_minutes,
  coalesce(t.unestimated, '{}') as unestimated,
  coalesce(t.services, '{}') as services,
  coalesce(o.turn_at, o.opened_at) as turn_at,
  rv.id as reservation_id,
  rv.slot_start as reserved_start,
  -- Spec 023, HU-03: the plate's legend, when the municipality has its own.
  m.plate_legend as plate_city_legend
from public.work_orders o
join public.customers c on c.id = o.customer_id
join public.vehicles v on v.id = o.vehicle_id
join public.vehicle_brands b on b.id = v.brand_id
left join public.vehicle_lines l on l.id = v.line_id
left join public.municipalities m on m.code = v.plate_city_code
left join public.reservations rv on rv.work_order_id = o.id
left join lateral (
  select
    sum(wl.price) as subtotal,
    sum(wl.estimated_minutes) as estimated_minutes,
    array_agg(wl.name order by wl.position) filter (where wl.estimated_minutes is null) as unestimated,
    array_agg(wl.name order by wl.position) as services
  from public.work_order_lines wl
  where wl.work_order_id = o.id
) t on true;
