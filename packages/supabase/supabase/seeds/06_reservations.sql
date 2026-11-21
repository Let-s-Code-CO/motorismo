-- Local agenda for development and E2E tests (spec 012), on the customers, vehicles and services of
-- the previous seeds. Saved through the same functions the app uses, acting as the first admin.
-- Dates are relative to today (Bogotá), so every `db:reset` has an agenda:
--
--   this week and the next   enabled, every day from 9:00 a. m. to 6:00 p. m.
--   tomorrow 10:00 a. m.     Camila, UIH-03D, «Lavado detallado»        pending
--   tomorrow 10:00 a. m.     Valentina, no vehicle, no services          pending (the slot is full)
--   tomorrow 11:00 a. m.     Andrés, his bicycle                         cancelled («Cambió de planes»)

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

select set_config('request.jwt.claims', null, true);
