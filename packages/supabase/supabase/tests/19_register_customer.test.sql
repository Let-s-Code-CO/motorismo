-- register_customer — staff register a customer and, optionally, their first vehicle (spec 022).
--
-- One call does both, so they are registered together or not at all (RN-01): a vehicle refused
-- (a plate already taken) leaves no customer behind, and a customer refused (an email already used)
-- leaves no vehicle. The customer goes through the same row security and guard as any registration
-- at the counter (spec 004: origin, who registered them, consent date, unique email), and the vehicle
-- through save_vehicle's rules (spec 005). Only staff can use it (RN-03).
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

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

select pg_temp.new_staff('00000000-0000-0000-0000-0000000022a1', 'rc-operador@test.local', 'Olga Operadora', 'operator');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000022c1', 'rc-camila@test.local', 'Camila Con Cuenta');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000022a1');

-- CA-06: only the customer -------------------------------------------------------------------------------
select pg_temp.remember('solo', public.register_customer(
  p_full_name => 'Sara Sola', p_email => 'rc-sara@test.local', p_phone => '3001110001'));
reset role;
select results_eq(
  $$ select full_name, origin::text, registered_by, consent_at is not null from public.customers
     where id = pg_temp.id_of('solo') $$,
  $$ values ('Sara Sola'::text, 'counter'::text, '00000000-0000-0000-0000-0000000022a1'::uuid, true) $$,
  'CA-06, RN-02: registered like any customer at the counter (origin, who, consent)');
select is_empty($$ select 1 from public.vehicles where customer_id = pg_temp.id_of('solo') $$,
  'CA-06: without a vehicle when none is given');

-- CA-07: the customer and their first vehicle --------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000022a1');
select pg_temp.remember('con_moto', public.register_customer(
  p_full_name => 'Mario Moto', p_email => null, p_phone => '3001110002',
  p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki', p_line_name => 'GSX-R600',
  p_color => 'black', p_plate => 'RCA12B'));
reset role;
select results_eq(
  $$ select plate, vehicle_type::text from public.vehicles where customer_id = pg_temp.id_of('con_moto') $$,
  $$ values ('RCA12B'::text, 'motorcycle'::text) $$,
  'CA-07: the vehicle is registered as the new customer''s');

-- RN-01: together or not at all ----------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000022a1');
select is(pg_temp.error_hint($$ select public.register_customer(
       p_full_name => 'Pedro Placa', p_email => 'rc-pedro@test.local', p_phone => null,
       p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha', p_line_name => 'BWS FI',
       p_color => 'blue', p_plate => 'RCA12B') $$),
  'vehicle_plate_taken', 'CA-07: a plate already taken is refused…');
reset role;
select is_empty($$ select 1 from public.customers where email = 'rc-pedro@test.local' $$,
  'RN-01: …and the customer is not registered either');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000022a1');
select is(pg_temp.error_hint($$ select public.register_customer(
       p_full_name => 'Otra Sara', p_email => 'rc-sara@test.local', p_phone => null,
       p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha', p_line_name => 'BWS FI',
       p_color => 'blue', p_plate => 'RCB34C') $$),
  'customer_email_taken', 'RN-02: an email already used is refused…');
reset role;
select is_empty($$ select 1 from public.vehicles where plate = 'RCB34C' $$,
  'RN-01: …and the vehicle is not registered either');
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000022a1');
select is(pg_temp.error_hint($$ select public.register_customer(
       p_full_name => 'Carlos Carro', p_email => 'rc-carlos@test.local', p_phone => null,
       p_vehicle_type => 'car', p_brand_name => 'Mazda', p_line_name => 'CX-30',
       p_color => 'gray', p_plate => 'RCC123') $$),
  'vehicle_class_required', 'RN-02: the vehicle''s own rules (a car needs its class)');
reset role;
select is_empty($$ select 1 from public.customers where email = 'rc-carlos@test.local' $$,
  'RN-01: and that refusal leaves no customer either');

-- RN-03: only staff ----------------------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000022c1');
select throws_ok($$ select public.register_customer(p_full_name => 'Falso', p_email => null, p_phone => '3001110009') $$,
  '42501', null, 'RN-03: a customer with an account cannot register customers');
reset role;
select function_privs_are('public', 'register_customer',
  array['text', 'text', 'text', 'vehicle_type', 'vehicle_class', 'text', 'text', 'integer', 'vehicle_color', 'text', 'text'],
  'anon', array[]::text[], 'RN-03: anonymous visitors cannot call it');

select * from finish();
rollback;
