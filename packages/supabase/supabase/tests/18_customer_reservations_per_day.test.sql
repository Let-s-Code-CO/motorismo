-- Several reservations of a customer for the same vehicle, one a day (spec 021).
--
-- From the app a customer may now keep several pending reservations for one vehicle (and without
-- vehicle), on different days: at most one per vehicle a day, and one without vehicle a day (RN-01,
-- replacing spec 014 RN-03). It also holds when they change a reservation, its day or only its
-- vehicle (CA-04). Staff keep their own rule (spec 012, RN-03: only the same slot).
-- The services to book now carry their estimated time, never their price (RF-02, RN-03).
--
-- The clock is fixed through private.agenda_now(): Wednesday 12 June 2030, 8:00.
begin;
create extension if not exists pgtap with schema extensions;

select plan(15);

create or replace function private.agenda_now()
returns timestamptz language sql stable set search_path = '' as $$
  select '2030-06-12 08:00-05'::timestamptz;
$$;
create function pg_temp.ts(p_day text, p_time text)
returns timestamptz language sql immutable as $$ select ('2030-06-' || p_day || ' ' || p_time || '-05')::timestamptz; $$;

create function pg_temp.new_staff(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role) values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', '{}');
  update public.profiles set status = 'active' where id = p_id;
end $$;
create function pg_temp.new_customer(p_id uuid, p_email text, p_name text)
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_app_meta_data,
                          raw_user_meta_data, email_confirmed_at, created_at)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{"provider":"email","providers":["email"]}',
          jsonb_build_object('full_name', p_name, 'data_consent', true), now(), now());
end $$;
create function pg_temp.act_as(p_id uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.error_hint(p_sql text)
returns text language plpgsql as $$
declare v_hint text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return coalesce(nullif(v_hint, ''), sqlstate);
end $$;

create temp table t_ids (name text primary key, id uuid not null);
grant select, insert on t_ids to authenticated;
create function pg_temp.remember(p_name text, p_id uuid)
returns uuid language sql as $$ insert into t_ids values (p_name, p_id) returning id; $$;
create function pg_temp.id_of(p_name text)
returns uuid language sql stable as $$ select id from t_ids where name = p_name; $$;

-- Independent of the seeds.
delete from public.reservation_extensions;
delete from public.reservation_services;
delete from public.reservations;
delete from public.agenda_days;
delete from public.agenda_weeks;

-- People, vehicles, services and an enabled week -------------------------------------------------------
select pg_temp.new_staff('00000000-0000-0000-0000-0000000021a1', 'rd-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000021c1', 'rd-camilo@test.local', 'Camilo Cliente');
select pg_temp.remember('camilo', id) from public.customers where email = 'rd-camilo@test.local';

insert into public.services (name, price_motorcycle, price_car, estimated_minutes) values
  ('RD Lavado', 25000, 40000, 30), ('RD Cadena', 15000, null, null);

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000021a1');
select pg_temp.remember('moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
  p_line_name => 'GSX-R600', p_color => 'black', p_plate => 'RDA12B'));
select pg_temp.remember('car', public.save_vehicle(
  p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'car', p_vehicle_class => 'utility', p_brand_name => 'Mazda',
  p_line_name => 'CX-30', p_color => 'gray', p_plate => 'RDB123', p_plate_city_code => '11001'));
-- The week of 10 June 2030, open every day from 9:00 to 18:00 in one-hour slots.
select public.save_agenda_week('2030-06-10', (
  select jsonb_agg(jsonb_build_object('is_open', true, 'opens_at', '09:00', 'closes_at', '18:00') order by i)
  from generate_series(0, 6) as i), true);

-- HU-01: several reservations of the same vehicle, one a day ------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000021c1');
select pg_temp.remember('r_thu', public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
  pg_temp.ts('13', '10:00'), '{}', null));
select lives_ok($$ select pg_temp.remember('r_fri', public.save_reservation(pg_temp.id_of('camilo'),
       pg_temp.id_of('moto'), pg_temp.ts('14', '10:00'), '{}', null)) $$,
  'CA-01: the same vehicle, booked for another day (Friday after Thursday)');
reset role;
select is((select count(*)::int from public.reservations
           where vehicle_id = pg_temp.id_of('moto') and status = 'pending'), 2,
  'CA-01: the vehicle keeps both pending (Thursday and Friday)');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000021c1');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
       pg_temp.ts('13', '15:00'), '{}', null) $$),
  'reservation_customer_limit', 'CA-02, RN-01: not twice the same day, even at another time (Thursday 15:00)');

select pg_temp.remember('r_none_thu', public.save_reservation(pg_temp.id_of('camilo'), null,
  pg_temp.ts('13', '09:00'), '{}', null));
select lives_ok($$ select public.save_reservation(pg_temp.id_of('camilo'), null,
       pg_temp.ts('14', '11:00'), '{}', null) $$,
  'CA-03: without vehicle, another day too');
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), null,
       pg_temp.ts('13', '16:00'), '{}', null) $$),
  'reservation_customer_limit', 'CA-03, RN-01: and one without vehicle a day');

-- CA-04: changing a reservation keeps the rule ----------------------------------------------------------
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
       pg_temp.ts('13', '11:00'), '{}', null, pg_temp.id_of('r_fri')) $$),
  'reservation_customer_limit', 'CA-04: moving Friday''s to Thursday, where the vehicle already has one');
reset role;
select is((select slot_start from public.reservations where id = pg_temp.id_of('r_fri')), pg_temp.ts('14', '10:00'),
  'CA-04: and the reservation stays as it was (Friday 10:00)');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000021c1');
select pg_temp.remember('r_car', public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('car'),
  pg_temp.ts('13', '12:00'), '{}', null));
select is(pg_temp.error_hint($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
       pg_temp.ts('13', '12:00'), '{}', null, pg_temp.id_of('r_car')) $$),
  'reservation_customer_limit', 'CA-04: changing only the vehicle, in the same slot, to one booked that day');
reset role;
select is((select vehicle_id from public.reservations where id = pg_temp.id_of('r_car')), pg_temp.id_of('car'),
  'CA-04: and it keeps its vehicle (the car)');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000021c1');
select lives_ok($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
       pg_temp.ts('13', '17:00'), '{}', null, pg_temp.id_of('r_thu')) $$,
  'CA-04: changing a reservation within its own day is not a second one (Thursday 10:00 → 17:00)');
select pg_temp.remember('r_sat', public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('car'),
  pg_temp.ts('15', '10:00'), '{}', null));
select lives_ok($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
       pg_temp.ts('15', '10:00'), '{}', null, pg_temp.id_of('r_sat')) $$,
  'CA-04: changing only the vehicle to one free that day (Saturday)');

-- Staff keep their rule (spec 012, RN-03) ----------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000021a1');
select lives_ok($$ select public.save_reservation(pg_temp.id_of('camilo'), pg_temp.id_of('moto'),
       pg_temp.ts('13', '14:00'), '{}', null) $$,
  'spec 012, RN-03: staff may book the same vehicle twice a day, in different slots');

-- RF-02, RN-03: the services to book carry their time, not their price ------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000021c1');
select results_eq(
  $$ select name, estimated_minutes from public.bookable_services() where name like 'RD %' order by name $$,
  $$ values ('RD Cadena'::text, null::smallint), ('RD Lavado'::text, 30::smallint) $$,
  'RF-02: each service with its estimated time (none for «RD Cadena»)');
select ok(
  pg_get_function_result('public.bookable_services()'::regprocedure) !~ 'price',
  'RN-03: never its price');
select is_empty($$ select 1 from public.services $$, 'RN-03: the catalog itself stays closed to customers');
reset role;

select * from finish();
rollback;
