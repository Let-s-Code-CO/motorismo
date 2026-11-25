-- Several reservations of a customer for the same vehicle, one a day, and the time of the services
-- to book (spec 021).
--
-- * save_reservation: from the app, a customer had one pending reservation per vehicle and one
--   without vehicle (spec 014, RN-03). Now it is one per vehicle a day, and one without vehicle a day
--   (spec 021, RN-01), also when a reservation changes its day or only its vehicle (CA-04). The rule
--   is checked once that day is locked (in both branches), as the seats are (spec 012, CA-06), so two
--   bookings at once cannot slip past it. Staff keep spec 012's rule.
-- * bookable_services: also each service's estimated time, to show the customer how long what they
--   choose takes (RF-02). Never its price: the catalog stays staff-only (spec 007; spec 021, RN-03).
--
-- seeds: unchanged — the rule only restricts new bookings, and the seeds keep one per vehicle a day.

-- save_reservation (spec 012, 014 and 021) ----------------------------------------------------------
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
      insert into public.reservation_services (reservation_id, service_id, position) values (v_id, v_service_id, v_position);
    end if;
  end loop;

  return v_id;
end;
$$;

-- bookable_services (spec 014, CA-12; spec 021, RF-02) ----------------------------------------------------
-- A function cannot change its output columns with «create or replace»: dropped and created again.
drop function public.bookable_services();

create function public.bookable_services()
returns table (id uuid, name text, motorcycle boolean, car boolean, bicycle boolean, estimated_minutes smallint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.name, s.price_motorcycle is not null, s.price_car is not null, s.price_bicycle is not null,
         s.estimated_minutes
  from public.services s
  where s.disabled_at is null
    and ((select public.is_staff()) or private.active_customer_id() is not null)
  order by s.name;
$$;

comment on function public.bookable_services() is
  'The active services to choose when booking: name, for which vehicle types they are offered and their '
  'estimated time (spec 014, CA-12; spec 021, RF-02). Never prices: the catalog stays staff-only (spec 007).';

revoke execute on function public.bookable_services() from public, anon;
grant execute on function public.bookable_services() to authenticated, service_role;
