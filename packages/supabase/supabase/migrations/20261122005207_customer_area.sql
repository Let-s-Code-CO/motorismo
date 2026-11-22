-- Spec 014 — what a customer with an account sees and does.
--
-- * Reservations made, changed or cancelled by the customer from the app say so (CA-16, CA-19):
--   created_by is optional when booked_by_customer.
-- * save_reservation and cancel_reservation let a customer book, change and cancel their own
--   reservations, with the agenda's rules (spec 012) and one pending reservation per vehicle and one
--   without vehicle (RN-03); the tolerance stays the staff's (RN-05).
-- * What the customer reads goes through SECURITY DEFINER functions that return only their rows and
--   only the fields they may see (RN-01): my_shop_orders, my_order_history, my_reservations and
--   bookable_day. The tables and the staff views stay closed to them.
-- * bookable_services: the active services, to choose them when booking (CA-12), without prices.
--
-- seeds: 06_reservations adds a reservation booked by cliente@ from the app.

-- Reservations by the customer ------------------------------------------------------------------------
alter table public.reservations
  alter column created_by drop not null,
  add column booked_by_customer boolean not null default false,
  add column updated_by_customer boolean not null default false,
  add column cancelled_by_customer boolean not null default false,
  add constraint reservations_created_by_someone check (created_by is not null or booked_by_customer),
  drop constraint reservations_cancelled_consistent,
  add constraint reservations_cancelled_consistent check (
    (status = 'cancelled') = (cancelled_at is not null and (cancelled_by is not null or cancelled_by_customer))
  );

-- The customer of the session, if active (never a disabled one).
create function private.active_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.customers c
  where c.user_id = (select auth.uid()) and c.disabled_at is null;
$$;

revoke execute on function private.active_customer_id() from public, anon;
grant execute on function private.active_customer_id() to authenticated, service_role;

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
  r.cancelled_by_customer
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
) sv on true
left join lateral (
  select count(*)::integer as times, sum(e.minutes)::integer as minutes
  from public.reservation_extensions e
  where e.reservation_id = r.id
) ex on true;

revoke all on table public.reservation_summaries from anon, authenticated;
grant select on table public.reservation_summaries to authenticated;

-- save_reservation and cancel_reservation, for staff and the customer -------------------------------
create or replace function public.save_reservation(
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
  v_staff boolean := (select public.is_staff());
  v_me uuid;
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

  -- Spec 014, RN-03: from the app, one pending reservation per vehicle and one without vehicle.
  if not v_staff and exists (
    select 1 from public.reservations
    where customer_id = v_customer_id and status = 'pending'
      and vehicle_id is not distinct from p_vehicle_id and id is distinct from p_id
  ) then
    perform private.agenda_fail('23505', 'reservation_customer_limit', 'the customer already has a pending reservation for it');
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
      insert into public.reservation_services (reservation_id, service_id, position) values (v_id, v_service_id, v_position);
    end if;
  end loop;

  return v_id;
end;
$$;

create or replace function public.cancel_reservation(p_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := (select public.is_staff());
  v_me uuid;
begin
  -- Spec 014: a customer cancels only their own reservations, the reason optional (CA-19, CA-21).
  if not v_staff then
    v_me := private.active_customer_id();
    if v_me is null or not exists (select 1 from public.reservations where id = p_id and customer_id = v_me) then
      perform private.agenda_fail('42501', 'reservation_customer_only', 'a customer cancels only their own reservations');
    end if;
  end if;
  perform private.pending_reservation(p_id);
  update public.reservations
     set status = 'cancelled', cancelled_at = private.agenda_now(),
         cancelled_by = case when v_staff then (select auth.uid()) end, cancelled_by_customer = not v_staff,
         cancel_reason = nullif(btrim(p_reason), '')
   where id = p_id;
end;
$$;

-- my_shop_orders (HU-01) ---------------------------------------------------------------------------------
-- Their open orders: the vehicle, since when, the services with their times and, in the queue, how
-- many orders go before (spec 012, RN-04: by turn, a reservation first on a tie, then by arrival).
create function public.my_shop_orders()
returns table (
  id uuid, number bigint, vehicle_type text, brand_name text, line_name text, plate text,
  opened_at timestamptz, started_at timestamptz, lines jsonb, ahead integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with queue as (
    select o.id,
           (row_number() over (
              order by coalesce(o.turn_at, o.opened_at), (rv.id is null), o.opened_at, o.number) - 1)::integer as ahead
    from public.work_orders o
    left join public.reservations rv on rv.work_order_id = o.id
    where o.status = 'open' and o.started_at is null
  )
  select o.id, o.number, v.vehicle_type::text, b.name, l.name, v.plate, o.opened_at, o.started_at,
         coalesce((
           select jsonb_agg(jsonb_build_object('name', wl.name, 'estimated_minutes', wl.estimated_minutes)
                            order by wl.position)
           from public.work_order_lines wl where wl.work_order_id = o.id), '[]'::jsonb),
         q.ahead
  from public.work_orders o
  join public.vehicles v on v.id = o.vehicle_id
  join public.vehicle_brands b on b.id = v.brand_id
  left join public.vehicle_lines l on l.id = v.line_id
  left join queue q on q.id = o.id
  where o.status = 'open' and o.customer_id = private.active_customer_id()
  order by o.opened_at;
$$;

-- my_order_history (HU-02) -------------------------------------------------------------------------------
-- Their closed orders (never the voided ones), newest first, a page at a time: lines, discount, total
-- and payments.
create function public.my_order_history(p_before timestamptz default null, p_limit integer default 10)
returns table (
  id uuid, number bigint, closed_at timestamptz, vehicle_type text, brand_name text, line_name text,
  plate text, lines jsonb, subtotal integer, discount integer, total integer, payments jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.number, o.closed_at, v.vehicle_type::text, b.name, l.name, v.plate,
         coalesce(t.lines, '[]'::jsonb), coalesce(t.subtotal, 0), o.discount,
         coalesce(t.subtotal, 0) - o.discount,
         coalesce((
           select jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount) order by p.method, p.amount desc)
           from public.work_order_payments p where p.work_order_id = o.id), '[]'::jsonb)
  from public.work_orders o
  join public.vehicles v on v.id = o.vehicle_id
  join public.vehicle_brands b on b.id = v.brand_id
  left join public.vehicle_lines l on l.id = v.line_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('name', wl.name, 'price', wl.price) order by wl.position) as lines,
           sum(wl.price)::integer as subtotal
    from public.work_order_lines wl where wl.work_order_id = o.id
  ) t on true
  where o.status = 'closed' and o.customer_id = private.active_customer_id()
    and (p_before is null or o.closed_at < p_before)
  order by o.closed_at desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;

-- my_reservations (HU-04) --------------------------------------------------------------------------------
-- Their pending reservations (nearest first), then the others since a day (latest first), with until
-- when they may arrive (spec 012, RN-11) and whether they or staff made or cancelled them.
create function public.my_reservations(p_since date)
returns table (
  id uuid, number bigint, status text, slot_start timestamptz, slot_end timestamptz,
  vehicle_id uuid, vehicle_type text, brand_name text, line_name text, plate text,
  service_ids uuid[], services text[], notes text, grace_until timestamptz,
  booked_by_customer boolean, cancelled_by_customer boolean, cancel_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.number, r.status::text, r.slot_start, r.slot_end,
         r.vehicle_id, v.vehicle_type::text, b.name, l.name, v.plate,
         coalesce(sv.service_ids, '{}'), coalesce(sv.services, '{}'), r.notes,
         r.slot_start + make_interval(mins => private.reservation_tolerance(r.tolerance_minutes)),
         r.booked_by_customer, r.cancelled_by_customer, r.cancel_reason
  from public.reservations r
  left join public.vehicles v on v.id = r.vehicle_id
  left join public.vehicle_brands b on b.id = v.brand_id
  left join public.vehicle_lines l on l.id = v.line_id
  left join lateral (
    select array_agg(rs.service_id order by rs.position) as service_ids,
           array_agg(s.name order by rs.position) as services
    from public.reservation_services rs
    join public.services s on s.id = rs.service_id
    where rs.reservation_id = r.id
  ) sv on true
  where r.customer_id = private.active_customer_id()
    and (r.status = 'pending' or (r.slot_start at time zone 'America/Bogota')::date >= p_since)
  order by (r.status = 'pending') desc,
           case when r.status = 'pending' then r.slot_start end asc,
           r.slot_start desc;
$$;

-- bookable_day (CA-12, CA-13) ---------------------------------------------------------------------------
-- The state of a day and its slots with seats, for staff or an active customer: counts only.
create function public.bookable_day(p_day date)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when not ((select public.is_staff()) or private.active_customer_id() is not null) then null
    else jsonb_build_object(
      'state', st.state,
      'slots', case when st.state = 'open' then coalesce((
        select jsonb_agg(jsonb_build_object(
                 'slot_start', ds.slot_start, 'slot_end', ds.slot_end, 'seats', s.seats,
                 'taken', private.taken_seats(ds.slot_start, ds.slot_end),
                 'started', ds.slot_start <= private.agenda_now()) order by ds.slot_start)
        from private.day_slots(p_day) ds cross join public.agenda_settings s), '[]'::jsonb)
        else '[]'::jsonb end)
    end
  from (
    select case when w.enabled is not true then 'unenabled' when not d.is_open then 'closed' else 'open' end as state
    from (select 1) one
    left join public.agenda_days d on d.day = p_day
    left join public.agenda_weeks w on w.week_start = d.week_start
  ) st;
$$;

revoke execute on function public.my_shop_orders() from public, anon;
revoke execute on function public.my_order_history(timestamptz, integer) from public, anon;
revoke execute on function public.my_reservations(date) from public, anon;
revoke execute on function public.bookable_day(date) from public, anon;
grant execute on function public.my_shop_orders() to authenticated, service_role;
grant execute on function public.my_order_history(timestamptz, integer) to authenticated, service_role;
grant execute on function public.my_reservations(date) to authenticated, service_role;
grant execute on function public.bookable_day(date) to authenticated, service_role;

-- bookable_services (CA-12) --------------------------------------------------------------------------
-- The active services, to choose them when booking: the name and for which vehicle types they are
-- offered, without prices or times (spec 007 keeps the catalog staff-only).
create function public.bookable_services()
returns table (id uuid, name text, motorcycle boolean, car boolean, bicycle boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.price_motorcycle is not null, s.price_car is not null, s.price_bicycle is not null
  from public.services s
  where s.disabled_at is null
    and ((select public.is_staff()) or private.active_customer_id() is not null)
  order by s.name;
$$;

revoke execute on function public.bookable_services() from public, anon;
grant execute on function public.bookable_services() to authenticated, service_role;
