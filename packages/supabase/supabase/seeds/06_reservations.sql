-- Local agenda for development and E2E tests (spec 012), on the customers, vehicles and services of
-- the previous seeds. Saved through the same functions the app uses, acting as the first admin.
-- Dates are relative to today (Bogotá), so every `db:reset` has an agenda:
--
--   this week and the next   enabled, every day from 9:00 a. m. to 6:00 p. m.
--   tomorrow 10:00 a. m.     Camila, UIH-03D, «Lavado detallado»        pending
--   tomorrow 10:00 a. m.     Valentina, no vehicle, no services          pending (the slot is full)
--   tomorrow 11:00 a. m.     Andrés, his bicycle                         cancelled («Cambió de planes»)
--   today, this hour         Gabriel, his Yamaha (registered here), «Lavado sencillo», 60 min of own
--                            tolerance: he arrived, and his order waits in the queue by the reserved
--                            time, «Reserva …»
--   today, this hour         Camila, no vehicle, 60 min of own tolerance: on her way, so «Órdenes»
--                            shows «Reserva por llegar» until the hour ends
--   now, no reservation      Mateo Mostrador (counter customer, registered here) and his Honda,
--                            «Lavado detallado»: in the queue after the reserved order
--   previous hour, late      Lina Tarde: arrived 6 minutes ago, past her 15 minutes → her turn is
--                            her arrival (she keeps the «Reserva» tag)
--   next hour, early         Sofía Temprano: arrived 8 minutes ago → her turn is her arrival
--   two hours ago            Valentina, no vehicle: «No asistió»
--   The queue then reads: Gabriel (reserved, on time), Camila (on her way), Andrés (10 min ago,
--   no reservation), Sofía (8 min, early), Lina (6 min, late), Mateo (now, no reservation).

select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'sebastian.pulido@motorismo.test'),
                    'role', 'authenticated')::text, true);

create temp table seed_agenda (name text primary key, id uuid);

create function pg_temp.week_days() returns jsonb language sql immutable as $$
  select jsonb_agg(jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '18:00'))
  from generate_series(1, 7);
$$;
-- Tomorrow at that time, in Bogotá.
create function pg_temp.tomorrow_at(p_time time) returns timestamptz language sql stable as $$
  select ((now() at time zone 'America/Bogota')::date + 1 + p_time) at time zone 'America/Bogota';
$$;

select public.save_agenda_week(
  date_trunc('week', (now() at time zone 'America/Bogota')::date)::date, pg_temp.week_days(), true);
select public.save_agenda_week(
  date_trunc('week', (now() at time zone 'America/Bogota')::date)::date + 7, pg_temp.week_days(), true);

insert into seed_agenda select 'camila', public.save_reservation(
  (select customer_id from public.vehicles where plate = 'UIH03D'),
  (select id from public.vehicles where plate = 'UIH03D'),
  pg_temp.tomorrow_at('10:00'),
  array[(select id from public.services where name = 'Lavado detallado')],
  'Pidió turno por WhatsApp');

insert into seed_agenda select 'valentina', public.save_reservation(
  (select customer_id from public.vehicles where plate = 'KDM482'), null, pg_temp.tomorrow_at('10:00'), '{}', null);

insert into seed_agenda select 'andres', public.save_reservation(
  (select customer_id from public.vehicles where vehicle_type = 'bicycle' limit 1),
  (select id from public.vehicles where vehicle_type = 'bicycle' limit 1),
  pg_temp.tomorrow_at('11:00'), '{}', null);
select public.cancel_reservation((select id from seed_agenda where name = 'andres'), 'Cambió de planes');

-- Today's examples are written directly (as the seeding superuser): their slot has already started,
-- which booking refuses; then the arrival goes through save_work_order, as the app does.
insert into seed_agenda select 'gabriel_moto', public.save_vehicle(
  p_customer_id => (select id from public.customers where email = 'cliente.google@motorismo.test'),
  p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha', p_line_name => 'BWS FI',
  p_color => 'blue', p_plate => 'GGM45F');

-- The slot of the current hour (aligned with the agenda). Gabriel has 60 minutes of his own
-- tolerance: he keeps the reserved time as his turn.
with booked as (
  insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, tolerance_minutes,
                                   created_at, created_by)
  select c.id, (select id from seed_agenda where name = 'gabriel_moto'),
         date_trunc('hour', now()), date_trunc('hour', now()) + interval '1 hour', 60,
         now() - interval '1 day', (select id from auth.users where email = 'sebastian.pulido@motorismo.test')
  from public.customers c where c.email = 'cliente.google@motorismo.test'
  returning id
)
insert into seed_agenda select 'gabriel', id from booked;

insert into public.reservation_services (reservation_id, service_id, position)
select (select id from seed_agenda where name = 'gabriel'), id, 1 from public.services where name = 'Lavado sencillo';

select public.save_work_order(
  (select id from public.customers where email = 'cliente.google@motorismo.test'),
  (select id from seed_agenda where name = 'gabriel_moto'),
  jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'Lavado sencillo'))),
  p_reservation_id => (select id from seed_agenda where name = 'gabriel'));

-- And someone who arrives now without a reservation: in the queue after the reserved order.
insert into public.customers (full_name, phone, origin, registered_by)
values ('Mateo Mostrador', '3109876543', 'counter',
        (select id from auth.users where email = 'sebastian.pulido@motorismo.test'));

insert into seed_agenda select 'mateo_moto', public.save_vehicle(
  p_customer_id => (select id from public.customers where full_name = 'Mateo Mostrador'),
  p_vehicle_type => 'motorcycle', p_brand_name => 'Honda', p_line_name => 'CB 190R',
  p_color => 'red', p_plate => 'MTM12A');

select public.save_work_order(
  (select id from public.customers where full_name = 'Mateo Mostrador'),
  (select id from seed_agenda where name = 'mateo_moto'),
  jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'Lavado detallado'))));

-- Two more who had reserved, to see both sides of the rule (RN-04). Their slots stay today: at
-- the first or the last hour of the day the example falls back to this hour.
insert into public.customers (full_name, phone, origin, registered_by) values
  ('Lina Tarde', '3112223344', 'counter', (select id from auth.users where email = 'sebastian.pulido@motorismo.test')),
  ('Sofía Temprano', '3125556677', 'counter', (select id from auth.users where email = 'sebastian.pulido@motorismo.test'));

insert into seed_agenda select 'lina_moto', public.save_vehicle(
  p_customer_id => (select id from public.customers where full_name = 'Lina Tarde'),
  p_vehicle_type => 'motorcycle', p_brand_name => 'AKT', p_line_name => 'NKD 125',
  p_color => 'black', p_plate => 'LNT34B');
insert into seed_agenda select 'sofia_moto', public.save_vehicle(
  p_customer_id => (select id from public.customers where full_name = 'Sofía Temprano'),
  p_vehicle_type => 'motorcycle', p_brand_name => 'Bajaj', p_line_name => 'Pulsar NS 200',
  p_color => 'white', p_plate => 'SFT56C');

create function pg_temp.today_hour(p_offset interval) returns timestamptz language sql stable as $$
  select case
    when ((date_trunc('hour', now()) + p_offset) at time zone 'America/Bogota')::date
         = (now() at time zone 'America/Bogota')::date
    then date_trunc('hour', now()) + p_offset
    else date_trunc('hour', now())
  end;
$$;

-- Lina reserved the previous hour and arrived 6 minutes ago, past her 15 minutes: her turn is her
-- arrival, like anyone's (she keeps the «Reserva» tag).
with booked as (
  insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, created_at, created_by)
  select c.id, (select id from seed_agenda where name = 'lina_moto'),
         pg_temp.today_hour(interval '-1 hour'), pg_temp.today_hour(interval '-1 hour') + interval '1 hour',
         now() - interval '1 day', (select id from auth.users where email = 'sebastian.pulido@motorismo.test')
  from public.customers c where c.full_name = 'Lina Tarde'
  returning id
)
insert into seed_agenda select 'lina', id from booked;

-- Sofía reserved the next hour and arrived 8 minutes ago, early: her turn is her arrival too.
with booked as (
  insert into public.reservations (customer_id, vehicle_id, slot_start, slot_end, created_at, created_by)
  select c.id, (select id from seed_agenda where name = 'sofia_moto'),
         pg_temp.today_hour(interval '1 hour'), pg_temp.today_hour(interval '1 hour') + interval '1 hour',
         now() - interval '1 day', (select id from auth.users where email = 'sebastian.pulido@motorismo.test')
  from public.customers c where c.full_name = 'Sofía Temprano'
  returning id
)
insert into seed_agenda select 'sofia', id from booked;

insert into seed_agenda select 'lina_order', public.save_work_order(
  (select id from public.customers where full_name = 'Lina Tarde'),
  (select id from seed_agenda where name = 'lina_moto'),
  jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'Lavado sencillo'))),
  p_reservation_id => (select id from seed_agenda where name = 'lina'));
insert into seed_agenda select 'sofia_order', public.save_work_order(
  (select id from public.customers where full_name = 'Sofía Temprano'),
  (select id from seed_agenda where name = 'sofia_moto'),
  jsonb_build_array(jsonb_build_object('service_id', (select id from public.services where name = 'Micropulido'))),
  p_reservation_id => (select id from seed_agenda where name = 'sofia'));

-- When they arrived, and the turn the rule gives each (RN-04), as if saved then.
update public.work_orders o
   set opened_at = now() - interval '6 minutes',
       turn_at = private.reservation_turn_at(now() - interval '6 minutes', r.slot_start, 15)
  from public.reservations r
 where o.id = (select id from seed_agenda where name = 'lina_order')
   and r.id = (select id from seed_agenda where name = 'lina');
update public.work_orders o
   set opened_at = now() - interval '8 minutes',
       turn_at = private.reservation_turn_at(now() - interval '8 minutes', r.slot_start, 15)
  from public.reservations r
 where o.id = (select id from seed_agenda where name = 'sofia_order')
   and r.id = (select id from seed_agenda where name = 'sofia');

-- Valentina reserved earlier today and never came: «No asistió» (the agenda lists it apart).
insert into public.reservations (customer_id, slot_start, slot_end, status, no_show_at, no_show_by,
                                 created_at, created_by)
select c.id, pg_temp.today_hour(interval '-2 hours'), pg_temp.today_hour(interval '-2 hours') + interval '1 hour',
       'no_show', now(), (select id from auth.users where email = 'sebastian.pulido@motorismo.test'),
       now() - interval '1 day', (select id from auth.users where email = 'sebastian.pulido@motorismo.test')
from public.customers c where c.email = 'valentina.vasquez@correo.test';

insert into public.reservations (customer_id, slot_start, slot_end, tolerance_minutes, notes, created_at, created_by)
select c.id, date_trunc('hour', now()), date_trunc('hour', now()) + interval '1 hour', 60, 'Avisó que va en camino',
       now() - interval '1 day', (select id from auth.users where email = 'sebastian.pulido@motorismo.test')
from public.customers c where c.email = 'cliente@motorismo.test';

select set_config('request.jwt.claims', null, true);
