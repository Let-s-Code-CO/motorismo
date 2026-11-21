-- Spec 012 — Agenda and reservations.
--
-- The admin enables the agenda week by week (Monday to Sunday), each day open with its hours or
-- closed, and sets the slot length, the seats per slot and the arrival tolerance (HU-05). Staff
-- book a seat in a slot for a customer, with or without a vehicle and services (HU-01); when the
-- customer arrives, the reservation becomes their order, which takes its turn in the queue by the
-- reserved time (HU-03, RN-04). Reservations are never deleted: they are attended, cancelled or a
-- no-show (HU-04, RN-05). Only the functions below write; staff read; customers see nothing.
--
-- Time: everything that looks at the clock asks private.agenda_now() (tests replace it), and the
-- business lives in America/Bogota (RN-09; Colombia has no daylight saving time).
--
-- seeds: seeds/06_reservations.sql (local only); the default settings row is data every
-- environment needs, so it is inserted here.

create type public.reservation_status as enum ('pending', 'attended', 'cancelled', 'no_show');

-- Settings ----------------------------------------------------------------------------------------
create table public.agenda_settings (
  id boolean primary key default true check (id),
  slot_minutes smallint not null default 60
    check (slot_minutes between 15 and 240 and slot_minutes % 15 = 0),
  seats smallint not null default 2 check (seats between 1 and 20),
  tolerance_minutes smallint not null default 15 check (tolerance_minutes between 0 and 60),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

comment on table public.agenda_settings is
  'The one agenda configuration of the business: slot length, seats per slot, arrival tolerance (spec 012, RF-07).';

insert into public.agenda_settings (id) values (true) on conflict do nothing;

-- Weeks and days ----------------------------------------------------------------------------------
create table public.agenda_weeks (
  week_start date primary key check (extract(isodow from week_start) = 1),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

comment on table public.agenda_weeks is
  'A week of the agenda (Monday to Sunday); without enabling it, nobody books in it (spec 012, RF-06).';

create table public.agenda_days (
  day date primary key,
  week_start date not null references public.agenda_weeks (week_start),
  is_open boolean not null default true,
  opens_at time not null default '09:00',
  closes_at time not null default '18:00',
  constraint agenda_days_in_week check (day between week_start and week_start + 6),
  constraint agenda_days_hours check (closes_at > opens_at)
);

comment on table public.agenda_days is
  'Each day of an agenda week: open with its hours, or closed (spec 012, CA-27).';

create index agenda_days_week_idx on public.agenda_days (week_start);

-- Reservations ------------------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  -- The order in which reservations were made: the first ones keep their seat (CA-31).
  number bigint generated always as identity unique,
  customer_id uuid not null references public.customers (id),
  vehicle_id uuid references public.vehicles (id),
  -- The slot as it was booked: changing the settings or the hours never moves it (RN-08).
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  notes text check (char_length(notes) <= 500),
  -- RN-11: its own tolerance, set by the admin; null = the general one.
  tolerance_minutes smallint check (tolerance_minutes between 0 and 60),
  status public.reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_at timestamptz,
  updated_by uuid references public.profiles (id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  cancel_reason text check (char_length(cancel_reason) <= 200),
  no_show_at timestamptz,
  no_show_by uuid references public.profiles (id),
  attended_at timestamptz,
  attended_by uuid references public.profiles (id),
  -- RF-04: the order opened when the customer arrived.
  work_order_id uuid unique references public.work_orders (id),
  constraint reservations_slot check (slot_end > slot_start),
  constraint reservations_attended_consistent check (
    (status = 'attended') = (attended_at is not null and attended_by is not null and work_order_id is not null)
  ),
  constraint reservations_cancelled_consistent check (
    (status = 'cancelled') = (cancelled_at is not null and cancelled_by is not null)
  ),
  constraint reservations_no_show_consistent check (
    (status = 'no_show') = (no_show_at is not null and no_show_by is not null)
  )
);

comment on table public.reservations is
  'A seat kept for a customer in a slot of the agenda (spec 012). Never deleted.';

-- RN-03: a vehicle has one pending reservation per slot.
create unique index reservations_one_pending_per_vehicle_slot on public.reservations (vehicle_id, slot_start)
  where status = 'pending';
create index reservations_slot_idx on public.reservations (slot_start);
create index reservations_customer_idx on public.reservations (customer_id);

create table public.reservation_services (
  reservation_id uuid not null references public.reservations (id),
  service_id uuid not null references public.services (id),
  position smallint not null,
  primary key (reservation_id, service_id)
);

comment on table public.reservation_services is
  'The services a reservation intends; their price and time are taken when it becomes an order (RN-07).';

create index reservation_services_service_idx on public.reservation_services (service_id);

-- RN-04: an order's turn in the queue. Null = its arrival (every order before this spec).
alter table public.work_orders add column turn_at timestamptz;
comment on column public.work_orders.turn_at is
  'The turn in the queue when the order came from a reservation (spec 012, RN-04); otherwise opened_at.';

-- Time ----------------------------------------------------------------------------------------------
create function private.agenda_now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

create function private.business_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (private.agenda_now() at time zone 'America/Bogota')::date;
$$;

-- A day and a time of the business, as an instant.
create function private.business_time(p_day date, p_time time)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select (p_day + p_time) at time zone 'America/Bogota';
$$;

-- RN-04: the turn of a customer who arrives at p_arrival for a slot that starts at p_slot_start.
-- Within the tolerance, the earliest of both (CA-16, CA-17); past it, the arrival.
create function private.reservation_turn_at(p_arrival timestamptz, p_slot_start timestamptz, p_tolerance_minutes integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case
    when p_arrival <= p_slot_start + make_interval(mins => p_tolerance_minutes) then least(p_arrival, p_slot_start)
    else p_arrival
  end;
$$;

-- RN-11: its own tolerance, or the general one.
create function private.reservation_tolerance(p_own smallint)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(p_own, (select tolerance_minutes from public.agenda_settings))::integer;
$$;

-- The slots of a day: an open day of an enabled week, from its opening, of the current length; only
-- full slots count (RN-01). Security invoker: it shows what the reader may read (staff).
create function private.day_slots(p_day date)
returns table (slot_start timestamptz, slot_end timestamptz)
language sql
stable
set search_path = ''
as $$
  select private.business_time(d.day, d.opens_at) + make_interval(mins => s.slot_minutes * g.n),
         private.business_time(d.day, d.opens_at) + make_interval(mins => s.slot_minutes * (g.n + 1))
  from public.agenda_days d
  join public.agenda_weeks w on w.week_start = d.week_start and w.enabled
  cross join public.agenda_settings s
  cross join lateral generate_series(
    0, (extract(epoch from (d.closes_at - d.opens_at))::integer / 60) / s.slot_minutes - 1
  ) as g (n)
  where d.day = p_day and d.is_open;
$$;

-- Active reservations (pending or attended) that overlap [p_start, p_end): the seats they take
-- (RN-02). Reservations of another length also count.
create function private.taken_seats(p_start timestamptz, p_end timestamptz, p_except uuid default null)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer from public.reservations r
  where r.status in ('pending', 'attended') and r.slot_start < p_end and r.slot_end > p_start
    and r.id is distinct from p_except;
$$;

revoke all on function private.agenda_now(), private.business_today(), private.business_time(date, time),
  private.reservation_turn_at(timestamptz, timestamptz, integer), private.reservation_tolerance(smallint),
  private.day_slots(date), private.taken_seats(timestamptz, timestamptz, uuid) from public;
grant execute on function private.agenda_now(), private.business_today(), private.business_time(date, time),
  private.reservation_turn_at(timestamptz, timestamptz, integer), private.reservation_tolerance(smallint),
  private.day_slots(date), private.taken_seats(timestamptz, timestamptz, uuid) to authenticated, service_role;

-- Reading: the slots of a day (CA-03) -----------------------------------------------------------------
create function public.agenda_slots(p_day date)
returns table (slot_start timestamptz, slot_end timestamptz, seats smallint, taken integer, started boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select ds.slot_start, ds.slot_end, s.seats,
         private.taken_seats(ds.slot_start, ds.slot_end),
         ds.slot_start <= private.agenda_now()
  from private.day_slots(p_day) ds
  cross join public.agenda_settings s
  order by ds.slot_start;
$$;

revoke execute on function public.agenda_slots(date) from public, anon;
grant execute on function public.agenda_slots(date) to authenticated, service_role;

-- Summary view --------------------------------------------------------------------------------------
-- SECURITY INVOKER: it shows only what the reader's RLS lets them see (staff).
create view public.reservation_summaries
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
  ) >= (select seats from public.agenda_settings)) as over_capacity
from public.reservations r
join public.customers c on c.id = r.customer_id
left join public.vehicles v on v.id = r.vehicle_id
left join public.vehicle_brands b on b.id = v.brand_id
left join public.vehicle_lines l on l.id = v.line_id
left join public.municipalities m on m.code = v.plate_city_code
left join public.work_orders o on o.id = r.work_order_id
left join lateral (
  select array_agg(rs.service_id order by rs.position) as service_ids,
         array_agg(s.name order by rs.position) as services
  from public.reservation_services rs
  join public.services s on s.id = rs.service_id
  where rs.reservation_id = r.id
) sv on true;

-- The order's summary gains its turn and its reservation (RN-04, RF-04). New columns go at the end.
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
  rv.slot_start as reserved_start
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

-- RLS and privileges ---------------------------------------------------------------------------------
alter table public.agenda_settings enable row level security;
alter table public.agenda_weeks enable row level security;
alter table public.agenda_days enable row level security;
alter table public.reservations enable row level security;
alter table public.reservation_services enable row level security;

create policy agenda_settings_select_staff
  on public.agenda_settings for select to authenticated using ((select public.is_staff()));
create policy agenda_weeks_select_staff
  on public.agenda_weeks for select to authenticated using ((select public.is_staff()));
create policy agenda_days_select_staff
  on public.agenda_days for select to authenticated using ((select public.is_staff()));
create policy reservations_select_staff
  on public.reservations for select to authenticated using ((select public.is_staff()));
create policy reservation_services_select_staff
  on public.reservation_services for select to authenticated using ((select public.is_staff()));

-- RN-05, CA-23: no direct writes and no deletes, for anyone; only the functions below write.
revoke all on table public.agenda_settings, public.agenda_weeks, public.agenda_days, public.reservations,
  public.reservation_services, public.reservation_summaries from anon, authenticated;
grant select on table public.agenda_settings, public.agenda_weeks, public.agenda_days, public.reservations,
  public.reservation_services, public.reservation_summaries to authenticated;
revoke all on table public.work_order_summaries from anon, authenticated;
grant select on table public.work_order_summaries to authenticated;

-- Errors carry a hint the app maps to a message (as in spec 008).
create function private.agenda_fail(p_errcode text, p_hint text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using message = p_message, errcode = p_errcode, hint = p_hint;
end;
$$;

-- save_agenda_week -------------------------------------------------------------------------------------
-- The admin saves a week's seven days (Monday first) and whether it is enabled (CA-26 to CA-28).
-- p_days: [{ "is_open": true, "opens_at": "09:00", "closes_at": "18:00" }, … ×7]. An open day must
-- close after it opens and hold one full slot (CA-30); a closed day keeps its hours, or the
-- proposal (RN-10) if they are not valid.
create function public.save_agenda_week(p_week_start date, p_days jsonb, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot int;
  v_elem jsonb;
  v_index int;
  v_day date;
  v_open boolean;
  v_opens time;
  v_closes time;
begin
  if not (select public.is_admin()) then
    perform private.agenda_fail('42501', 'agenda_admin_only', 'only an admin manages the agenda');
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1
     or p_days is null or jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) <> 7 then
    perform private.agenda_fail('22023', 'agenda_week_invalid', 'a week starts on Monday and has seven days');
  end if;
  select slot_minutes into v_slot from public.agenda_settings;

  insert into public.agenda_weeks as w (week_start, enabled, updated_at, updated_by)
  values (p_week_start, coalesce(p_enabled, false), now(), (select auth.uid()))
  on conflict (week_start) do update
    set enabled = excluded.enabled, updated_at = excluded.updated_at, updated_by = excluded.updated_by;

  for v_elem, v_index in select e, i - 1 from jsonb_array_elements(p_days) with ordinality as x (e, i) loop
    v_day := p_week_start + v_index;
    v_open := coalesce((v_elem ->> 'is_open')::boolean, true);
    begin
      v_opens := (v_elem ->> 'opens_at')::time;
      v_closes := (v_elem ->> 'closes_at')::time;
    exception when others then
      v_opens := null;
      v_closes := null;
    end;
    if v_open and (v_opens is null or v_closes is null or v_closes <= v_opens
                   or extract(epoch from (v_closes - v_opens)) / 60 < v_slot) then
      perform private.agenda_fail('22023', 'agenda_day_invalid:' || to_char(v_day, 'YYYY-MM-DD'),
        format('the day %s must close after it opens and hold a full slot', v_day));
    end if;
    if not v_open and (v_opens is null or v_closes is null or v_closes <= v_opens) then
      v_opens := '09:00';
      v_closes := '18:00';
    end if;
    insert into public.agenda_days (day, week_start, is_open, opens_at, closes_at)
    values (v_day, p_week_start, v_open, v_opens, v_closes)
    on conflict (day) do update
      set is_open = excluded.is_open, opens_at = excluded.opens_at, closes_at = excluded.closes_at;
  end loop;
end;
$$;

-- save_agenda_settings --------------------------------------------------------------------------------
-- The admin sets the slot length (15 to 240, in steps of 15), the seats (1 to 20) and the general
-- tolerance (0 to 60) (CA-29). Reservations already made keep their time (RN-08).
create function public.save_agenda_settings(p_slot_minutes integer, p_seats integer, p_tolerance_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    perform private.agenda_fail('42501', 'agenda_admin_only', 'only an admin manages the agenda');
  end if;
  if p_slot_minutes is null or p_slot_minutes not between 15 and 240 or p_slot_minutes % 15 <> 0
     or p_seats is null or p_seats not between 1 and 20
     or p_tolerance_minutes is null or p_tolerance_minutes not between 0 and 60 then
    perform private.agenda_fail('22023', 'agenda_settings_out_of_range', 'a setting is out of range');
  end if;
  update public.agenda_settings
     set slot_minutes = p_slot_minutes, seats = p_seats, tolerance_minutes = p_tolerance_minutes,
         updated_at = now(), updated_by = (select auth.uid())
   -- The single row. The API's connections refuse an UPDATE without WHERE (safeupdate).
   where id;
end;
$$;

-- save_reservation ---------------------------------------------------------------------------------------
-- Staff book a seat (no p_id, CA-01 to CA-08) or change a pending reservation (CA-20). The slot must
-- be the start of a slot of an open day of an enabled week, not started (RN-01), with a free seat
-- (RN-02). The day's row is locked before counting, so two bookings at the same time line up and the
-- second one sees the slot full (CA-06). On a change, the customer stays; an unchanged slot is not
-- checked again.
create function public.save_reservation(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_slot_start timestamptz,
  p_service_ids uuid[] default '{}',
  p_notes text default null,
  p_id uuid default null
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
begin
  if not (select public.is_staff()) then
    perform private.agenda_fail('42501', 'reservation_staff_only', 'only staff manage reservations');
  end if;

  if p_id is not null then
    select * into v_reservation from public.reservations where id = p_id for update;
    if not found then
      perform private.agenda_fail('P0002', 'reservation_not_found', 'reservation not found');
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
    if p_vehicle_id is not null and (case v_vehicle.vehicle_type
         when 'motorcycle' then v_service.price_motorcycle
         when 'car' then v_service.price_car
         else v_service.price_bicycle end) is null then
      perform private.agenda_fail('23514', 'reservation_service_unavailable', 'the service is not offered for this vehicle');
    end if;
  end loop;

  if v_slot_changed then
    v_day := (p_slot_start at time zone 'America/Bogota')::date;
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
    if p_vehicle_id is not null and exists (
      select 1 from public.reservations
      where vehicle_id = p_vehicle_id and slot_start = p_slot_start and status = 'pending' and id <> p_id
    ) then
      perform private.agenda_fail('23505', 'reservation_vehicle_taken', 'the vehicle already has a reservation in this slot');
    end if;
  end if;

  if p_id is null then
    insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, notes, created_at, created_by)
    values (v_customer_id, p_vehicle_id, p_slot_start, v_slot_end, nullif(btrim(p_notes), ''),
            private.agenda_now(), (select auth.uid()))
    returning id into v_id;
  else
    v_id := p_id;
    update public.reservations
       set vehicle_id = p_vehicle_id, slot_start = p_slot_start, slot_end = v_slot_end,
           notes = nullif(btrim(p_notes), ''), updated_at = private.agenda_now(), updated_by = (select auth.uid())
     where id = p_id;
    delete from public.reservation_services where reservation_id = p_id;
  end if;

  foreach v_service_id in array coalesce(p_service_ids, '{}') loop
    if not exists (select 1 from public.reservation_services where reservation_id = v_id and service_id = v_service_id) then
      v_position := v_position + 1;
      insert into public.reservation_services (reservation_id, service_id, position) values (v_id, v_service_id, v_position);
    end if;
  end loop;

  return v_id;
end;
$$;

-- A pending reservation, locked, or an error (shared by the transitions below).
create function private.pending_reservation(p_id uuid)
returns public.reservations
language plpgsql
set search_path = ''
as $$
declare
  v_reservation public.reservations;
begin
  select * into v_reservation from public.reservations where id = p_id for update;
  if not found then
    perform private.agenda_fail('P0002', 'reservation_not_found', 'reservation not found');
  end if;
  if v_reservation.status <> 'pending' then
    perform private.agenda_fail('23514', 'reservation_not_pending', 'the reservation is no longer pending');
  end if;
  return v_reservation;
end;
$$;

-- cancel_reservation ---------------------------------------------------------------------------------------
-- Staff cancel a pending reservation, with an optional reason (CA-21); it frees its seat.
create function public.cancel_reservation(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_staff()) then
    perform private.agenda_fail('42501', 'reservation_staff_only', 'only staff manage reservations');
  end if;
  perform private.pending_reservation(p_id);
  update public.reservations
     set status = 'cancelled', cancelled_at = private.agenda_now(), cancelled_by = (select auth.uid()),
         cancel_reason = nullif(btrim(p_reason), '')
   where id = p_id;
end;
$$;

-- mark_reservation_no_show ---------------------------------------------------------------------------------
-- Staff record that the customer did not come, once the slot's start plus its tolerance has passed
-- (CA-22, RN-11).
create function public.mark_reservation_no_show(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.reservations;
begin
  if not (select public.is_staff()) then
    perform private.agenda_fail('42501', 'reservation_staff_only', 'only staff manage reservations');
  end if;
  v_reservation := private.pending_reservation(p_id);
  if private.agenda_now() <= v_reservation.slot_start
       + make_interval(mins => private.reservation_tolerance(v_reservation.tolerance_minutes)) then
    perform private.agenda_fail('23514', 'reservation_no_show_too_early', 'the customer may still arrive');
  end if;
  update public.reservations
     set status = 'no_show', no_show_at = private.agenda_now(), no_show_by = (select auth.uid())
   where id = p_id;
end;
$$;

-- set_reservation_tolerance --------------------------------------------------------------------------------
-- The admin gives a pending reservation its own tolerance (0 to 60), or null for the general one
-- (CA-24, CA-25, RN-11).
create function public.set_reservation_tolerance(p_id uuid, p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    perform private.agenda_fail('42501', 'reservation_admin_only', 'only an admin changes a reservation''s tolerance');
  end if;
  if p_minutes is not null and p_minutes not between 0 and 60 then
    perform private.agenda_fail('22023', 'reservation_tolerance_out_of_range', 'a tolerance goes from 0 to 60 minutes');
  end if;
  perform private.pending_reservation(p_id);
  update public.reservations
     set tolerance_minutes = p_minutes, updated_at = private.agenda_now(), updated_by = (select auth.uid())
   where id = p_id;
end;
$$;

-- save_work_order, with the reservation the customer arrived with -----------------------------------------
-- As in spec 008, plus p_reservation_id (CA-12, CA-13, CA-19): a pending reservation of today and of
-- the same customer. The order takes its turn by RN-04 (arrival = when it opens, or the opening of
-- the order the vehicle already had, if not started) and the reservation becomes attended, linked
-- to it, in the same transaction.
drop function public.save_work_order(uuid, uuid, jsonb, integer, text, uuid);

create function public.save_work_order(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_lines jsonb,
  p_discount integer default null,
  p_notes text default null,
  p_id uuid default null,
  p_reservation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.work_orders;
  v_vehicle public.vehicles;
  v_customer public.customers;
  v_busy bigint;
  v_reservation public.reservations;
begin
  if not (select public.is_staff()) then
    perform private.work_order_fail('42501', 'work_order_staff_only', 'only staff manage work orders');
  end if;

  if p_reservation_id is not null then
    select * into v_reservation from public.reservations where id = p_reservation_id for update;
    if not found then
      perform private.agenda_fail('P0002', 'reservation_not_found', 'reservation not found');
    end if;
    if v_reservation.status <> 'pending' then
      perform private.agenda_fail('23514', 'reservation_not_pending', 'the reservation is no longer pending');
    end if;
    if (v_reservation.slot_start at time zone 'America/Bogota')::date <> private.business_today() then
      perform private.agenda_fail('23514', 'reservation_not_today', 'the reservation is not for today');
    end if;
    if v_reservation.customer_id <> p_customer_id then
      perform private.agenda_fail('23514', 'reservation_customer_mismatch', 'the reservation is another customer''s');
    end if;
  end if;

  if p_id is null then
    select * into v_customer from public.customers where id = p_customer_id;
    if not found then
      perform private.work_order_fail('P0002', 'work_order_customer_not_found', 'customer not found');
    end if;
    if v_customer.disabled_at is not null then
      perform private.work_order_fail('23514', 'work_order_customer_disabled', 'the customer is disabled');
    end if;
    select * into v_vehicle from public.vehicles where id = p_vehicle_id;
    if not found or v_vehicle.customer_id <> p_customer_id then
      perform private.work_order_fail('23514', 'work_order_vehicle_invalid', 'the vehicle is not the customer''s');
    end if;
    if v_vehicle.retired_at is not null then
      perform private.work_order_fail('23514', 'work_order_vehicle_retired', 'the vehicle is retired');
    end if;
    select number into v_busy from public.work_orders where vehicle_id = p_vehicle_id and status = 'open';
    if v_busy is not null then
      perform private.work_order_fail('23505', 'work_order_vehicle_busy',
        format('the vehicle already has the open order #%s', v_busy));
    end if;
    insert into public.work_orders (customer_id, vehicle_id, notes, opened_at, opened_by)
    values (p_customer_id, p_vehicle_id, nullif(btrim(p_notes), ''), private.agenda_now(), (select auth.uid()))
    returning * into v_order;
  else
    select * into v_order from public.work_orders where id = p_id for update;
    if not found then
      perform private.work_order_fail('P0002', 'work_order_not_found', 'work order not found');
    end if;
    if v_order.status <> 'open' then
      perform private.work_order_fail('23514', 'work_order_not_open', 'only an open order can be edited');
    end if;
    if p_reservation_id is not null then
      if v_order.started_at is not null then
        perform private.agenda_fail('23514', 'reservation_order_started', 'the order has already started');
      end if;
      if exists (select 1 from public.reservations where work_order_id = p_id) then
        perform private.agenda_fail('23514', 'reservation_order_has_reservation', 'the order already has a reservation');
      end if;
      if v_order.customer_id <> v_reservation.customer_id then
        perform private.agenda_fail('23514', 'reservation_customer_mismatch', 'the reservation is another customer''s');
      end if;
    end if;
    select * into v_vehicle from public.vehicles where id = v_order.vehicle_id;
    update public.work_orders set notes = nullif(btrim(p_notes), '') where id = v_order.id;
  end if;

  perform private.work_order_write_lines(v_order.id, v_vehicle.vehicle_type, p_lines);
  perform private.work_order_set_discount(v_order.id, coalesce(p_discount, v_order.discount));

  if p_reservation_id is not null then
    update public.work_orders
       set turn_at = private.reservation_turn_at(v_order.opened_at, v_reservation.slot_start,
                                                 private.reservation_tolerance(v_reservation.tolerance_minutes))
     where id = v_order.id;
    update public.reservations
       set status = 'attended', attended_at = private.agenda_now(), attended_by = (select auth.uid()),
           work_order_id = v_order.id
     where id = p_reservation_id;
  end if;

  return v_order.id;
end;
$$;

revoke execute on function public.save_agenda_week(date, jsonb, boolean),
  public.save_agenda_settings(integer, integer, integer),
  public.save_reservation(uuid, uuid, timestamptz, uuid[], text, uuid),
  public.cancel_reservation(uuid, text),
  public.mark_reservation_no_show(uuid),
  public.set_reservation_tolerance(uuid, integer),
  public.save_work_order(uuid, uuid, jsonb, integer, text, uuid, uuid) from public, anon;
grant execute on function public.save_agenda_week(date, jsonb, boolean),
  public.save_agenda_settings(integer, integer, integer),
  public.save_reservation(uuid, uuid, timestamptz, uuid[], text, uuid),
  public.cancel_reservation(uuid, text),
  public.mark_reservation_no_show(uuid),
  public.set_reservation_tolerance(uuid, integer),
  public.save_work_order(uuid, uuid, jsonb, integer, text, uuid, uuid) to authenticated, service_role;
revoke all on function private.agenda_fail(text, text, text), private.pending_reservation(uuid) from public;
