-- Spec 012, amendment HU-06 — the queue and the agenda up to date without reloading.
--
-- * Staff give a customer on their way 5 more minutes to keep their turn (CA-34, RN-11).
-- * Every «+5 min» is recorded, with who and when, so staff see how much time a customer was given
--   (CA-38).
-- * Orders, reservations and the agenda are published for Realtime (CA-35). Realtime only sends a
--   change to whoever may read the row (the RLS policies of specs 008 and 012: staff only).
--
-- seeds: unchanged — the extensions are only made from the app.

-- The time given to arrive (CA-38) ------------------------------------------------------------------
create table public.reservation_extensions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id),
  minutes smallint not null check (minutes > 0),
  -- The reservation's tolerance once given: it kept its turn until slot_start + this.
  tolerance_after smallint not null check (tolerance_after between 0 and 60),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id)
);

comment on table public.reservation_extensions is
  'Each «+5 min» given to a customer on their way, with who and when (spec 012, CA-38). Never deleted.';

create index reservation_extensions_reservation_idx on public.reservation_extensions (reservation_id, created_at);

alter table public.reservation_extensions enable row level security;
create policy reservation_extensions_select_staff
  on public.reservation_extensions for select to authenticated using ((select public.is_staff()));
revoke all on table public.reservation_extensions from anon, authenticated;
grant select on table public.reservation_extensions to authenticated;

create view public.reservation_extension_summaries
with (security_invoker = true)
as
select
  e.id,
  e.reservation_id,
  e.minutes,
  e.tolerance_after,
  r.slot_start + make_interval(mins => e.tolerance_after) as grace_until,
  e.created_at,
  private.staff_name(e.created_by) as created_by_name
from public.reservation_extensions e
join public.reservations r on r.id = e.reservation_id;

revoke all on table public.reservation_extension_summaries from anon, authenticated;
grant select on table public.reservation_extension_summaries to authenticated;

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
  coalesce(ex.minutes, 0) as extended_minutes
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

-- extend_reservation_tolerance ---------------------------------------------------------------------
-- Any staff member, while the reservation is pending and its customer may still arrive: the
-- effective tolerance (its own, or the general one) grows by 5 minutes and becomes its own, up to 60.
-- Returns the new tolerance.
create function public.extend_reservation_tolerance(p_id uuid)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.reservations;
  v_tolerance int;
begin
  if not (select public.is_staff()) then
    perform private.agenda_fail('42501', 'reservation_staff_only', 'only staff manage reservations');
  end if;
  v_reservation := private.pending_reservation(p_id);
  v_tolerance := private.reservation_tolerance(v_reservation.tolerance_minutes);
  if private.agenda_now() > v_reservation.slot_start + make_interval(mins => v_tolerance) then
    perform private.agenda_fail('23514', 'reservation_tolerance_passed', 'the customer is past their tolerance');
  end if;
  if v_tolerance + 5 > 60 then
    perform private.agenda_fail('22023', 'reservation_tolerance_max', 'a tolerance goes up to 60 minutes');
  end if;

  update public.reservations
     set tolerance_minutes = v_tolerance + 5, updated_at = private.agenda_now(), updated_by = (select auth.uid())
   where id = p_id;
  insert into public.reservation_extensions (reservation_id, minutes, tolerance_after, created_at, created_by)
  values (p_id, 5, v_tolerance + 5, private.agenda_now(), (select auth.uid()));
  return (v_tolerance + 5)::smallint;
end;
$$;

revoke execute on function public.extend_reservation_tolerance(uuid) from public, anon;
grant execute on function public.extend_reservation_tolerance(uuid) to authenticated, service_role;

-- Realtime --------------------------------------------------------------------------------------------
alter publication supabase_realtime add table public.work_orders, public.reservations,
  public.agenda_days, public.agenda_weeks, public.agenda_settings;
