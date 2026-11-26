-- Local work orders for development and E2E tests (spec 008), on the customers, vehicles,
-- services and employees of the previous seeds. Saved through the same functions the app uses,
-- acting as the first admin.
--
--   #1  Valentina, KDM-482   Lavado detallado (Elkin)                closed 10 days ago, card
--   #2  Camila, UIH-03D (SBK/SSP)  Lavado Pro Wash + Combo de lavado Deluxe, $ 5.000 off
--                                  (46.000 + 182.000 − 5.000)    closed 3 days ago, cash + transfer
--   #3  Camila, UIH-03D       Lavado Pro Wash                        voided (duplicated)
--   #4  Camila, UIH-03D       Paquete de lavado Premium + Otro «Limpieza de cadena», no time
--                             in progress (arrived 40 min ago, started 20 min ago)
--   #5  Andrés, bicycle       Lavado sencillo                       in the queue, arrived 10 min ago

select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'sebastian.pulido@motorismo.test'),
                    'role', 'authenticated')::text, true);

create temp table seed_ids (name text primary key, id uuid not null);

insert into seed_ids
select 'valentina_car', v.id from public.vehicles v where v.plate = 'KDM482'
union all select 'camila_moto', v.id from public.vehicles v where v.plate = 'UIH03D'
union all select 'elkin', e.id from public.employees e where e.full_name = 'Elkin Estrada'
union all select 'paula', e.id from public.employees e where e.full_name = 'Paula Pineda'
union all select s.name, s.id from public.services s;

create function pg_temp.sid(p_name text) returns uuid language sql stable as
$$ select id from seed_ids where name = p_name $$;

-- #1
insert into seed_ids select 'o1', public.save_work_order(
  (select customer_id from public.vehicles where id = pg_temp.sid('valentina_car')), pg_temp.sid('valentina_car'),
  jsonb_build_array(jsonb_build_object('service_id', pg_temp.sid('Lavado detallado'),
    'employees', jsonb_build_array(jsonb_build_object('employee_id', pg_temp.sid('elkin'), 'share_pct', 100)))));
select public.close_work_order(pg_temp.sid('o1'), '[{"method":"card","amount":95000}]');

-- #2
insert into seed_ids select 'o2', public.save_work_order(
  (select customer_id from public.vehicles where id = pg_temp.sid('camila_moto')), pg_temp.sid('camila_moto'),
  jsonb_build_array(
    jsonb_build_object('service_id', pg_temp.sid('Lavado Pro Wash'),
      'employees', jsonb_build_array(jsonb_build_object('employee_id', pg_temp.sid('paula'), 'share_pct', 100))),
    jsonb_build_object('service_id', pg_temp.sid('Combo de lavado Deluxe'),
      'employees', jsonb_build_array(
        jsonb_build_object('employee_id', pg_temp.sid('elkin'), 'share_pct', 80),
        jsonb_build_object('employee_id', pg_temp.sid('paula'), 'share_pct', 20)))),
  p_discount => 5000);
select public.close_work_order(pg_temp.sid('o2'),
  '[{"method":"cash","amount":150000},{"method":"transfer","amount":73000}]');

-- #3
insert into seed_ids select 'o3', public.save_work_order(
  (select customer_id from public.vehicles where id = pg_temp.sid('camila_moto')), pg_temp.sid('camila_moto'),
  jsonb_build_array(jsonb_build_object('service_id', pg_temp.sid('Lavado Pro Wash'))));
select public.void_work_order(pg_temp.sid('o3'), 'Orden duplicada');

-- #4
insert into seed_ids select 'o4', public.save_work_order(
  (select customer_id from public.vehicles where id = pg_temp.sid('camila_moto')), pg_temp.sid('camila_moto'),
  jsonb_build_array(
    jsonb_build_object('service_id', pg_temp.sid('Paquete de lavado Premium'),
      'employees', jsonb_build_array(jsonb_build_object('employee_id', pg_temp.sid('elkin'), 'share_pct', 100))),
    jsonb_build_object('name', 'Limpieza de cadena', 'price', 15000)),
  p_notes => 'Trae un rayón en el tanque');

select public.start_work_order(pg_temp.sid('o4'));

-- #5
insert into seed_ids select 'andres_bike', v.id from public.vehicles v
  join public.customers c on c.id = v.customer_id where c.full_name = 'Andrés Ñáñez';
insert into seed_ids select 'o5', public.save_work_order(
  (select customer_id from public.vehicles where id = pg_temp.sid('andres_bike')), pg_temp.sid('andres_bike'),
  jsonb_build_array(jsonb_build_object('service_id', pg_temp.sid('Lavado sencillo'),
    'employees', jsonb_build_array(jsonb_build_object('employee_id', pg_temp.sid('paula'), 'share_pct', 100)))));

-- Dates as if they happened before today.
update public.work_orders set opened_at = now() - interval '10 days 2 hours', closed_at = now() - interval '10 days'
 where id = pg_temp.sid('o1');
update public.work_orders set opened_at = now() - interval '3 days 3 hours', closed_at = now() - interval '3 days'
 where id = pg_temp.sid('o2');
update public.work_orders set opened_at = now() - interval '3 days 4 hours', voided_at = now() - interval '3 days 4 hours'
 where id = pg_temp.sid('o3');
update public.work_orders set opened_at = now() - interval '40 minutes', started_at = now() - interval '20 minutes'
 where id = pg_temp.sid('o4');
update public.work_orders set opened_at = now() - interval '10 minutes' where id = pg_temp.sid('o5');

select set_config('request.jwt.claims', null, true);
