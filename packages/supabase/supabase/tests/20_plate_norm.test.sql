-- The plate as the norm draws it: the cities that issue plates and their legend (spec 023).
--
-- * Only the municipalities with a transit authority in the RUNT's list issue plates (RN-04); a car's
--   plate city is chosen among them (CA-07), and a car registered before with another city keeps it
--   when corrected (CA-08).
-- * A municipality may have its own legend for the plate, set or cleared only by an admin (CA-10,
--   CA-11): capitals without accents, at most 17 characters, what fits inside the frame (RN-05).
-- * The orders' summary carries that legend next to the city's name.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

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

create temp table t_ids (name text primary key, id text not null);
grant select, insert on t_ids to authenticated;
create function pg_temp.remember(p_name text, p_id text)
returns text language sql as $$ insert into t_ids values (p_name, p_id) returning id; $$;
create function pg_temp.id_of(p_name text)
returns text language sql stable as $$ select id from t_ids where name = p_name; $$;

select pg_temp.new_staff('00000000-0000-0000-0000-0000000023a1', 'pn-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000023a2', 'pn-op@test.local', 'Olga Operadora', 'operator');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000023c1', 'pn-cliente@test.local', 'Carla Cliente');
-- A municipality that issues no plates, and a customer with a car.
select pg_temp.remember('quiet', (select code from public.municipalities where not issues_plates order by code limit 1));
insert into public.customers (full_name, phone, origin, registered_by)
values ('Pedro Placa', '3001230023', 'counter', '00000000-0000-0000-0000-0000000023a1');
select pg_temp.remember('pedro', (select id::text from public.customers where full_name = 'Pedro Placa'));

-- Columns and rule (RN-04, RN-05) ------------------------------------------------------------------------
select has_column('public', 'municipalities', 'issues_plates', 'RN-04: whether a municipality issues plates');
select has_column('public', 'municipalities', 'plate_legend', 'RN-05: its own legend for the plate');
select is((select count(*)::int from public.municipalities where issues_plates), 294,
  'RN-04: the 294 municipalities of the RUNT''s transit authorities issue plates (297 rows, 3 twice)');
select ok((select bool_and(issues_plates) from public.municipalities where code in ('11001', '05001')),
  'RN-04: Bogotá, D.C. and Medellín issue plates');
select throws_ok($$ update public.municipalities set plate_legend = 'bogota' where code = '11001' $$,
  '23514', null, 'RN-05: never a legend in lower case, even written directly');
select has_column('public', 'work_order_summaries', 'plate_city_legend',
  'HU-03: the orders'' summary carries the legend');

-- set_plate_legend (CA-10, CA-11) -------------------------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000023a1');
select lives_ok($$ select public.set_plate_legend('11001', 'STFE DE BOGOTA') $$,
  'CA-10: an admin gives Bogotá, D.C. its own legend');
select is((select plate_legend from public.municipalities where code = '11001'), 'STFE DE BOGOTA',
  'CA-10: and it is kept');
select lives_ok($$ select public.set_plate_legend('11001', '  ') $$, 'CA-10: and clears it');
select is((select plate_legend from public.municipalities where code = '11001'), null,
  'CA-10: back to the name');
select is(pg_temp.error_hint($$ select public.set_plate_legend('11001', 'BOGOTÁ') $$),
  'plate_legend_invalid', 'RN-05: never with accents');
select is(pg_temp.error_hint($$ select public.set_plate_legend('11001', 'ABCDEFGHIJKLMNOPQR') $$),
  'plate_legend_invalid', 'RN-05: never longer than what fits inside the frame, 17 characters (18)');
select is(pg_temp.error_hint(format($$ select public.set_plate_legend(%L, 'NADA') $$, pg_temp.id_of('quiet'))),
  'plate_city_not_issuing', 'CA-10: only for a municipality that issues plates');
select pg_temp.act_as('00000000-0000-0000-0000-0000000023a2');
select is(pg_temp.error_hint($$ select public.set_plate_legend('11001', 'BOGOTA') $$),
  'plate_admin_only', 'CA-11: an operator cannot');
select pg_temp.act_as('00000000-0000-0000-0000-0000000023c1');
select is(pg_temp.error_hint($$ select public.set_plate_legend('11001', 'BOGOTA') $$),
  'plate_admin_only', 'CA-11: nor a customer');

-- The car's plate city (CA-07, CA-08) -------------------------------------------------------------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000023a1');
select is(pg_temp.error_hint(format($$ select public.save_vehicle(
       p_customer_id => %L::uuid, p_vehicle_type => 'car', p_vehicle_class => 'automobile',
       p_brand_name => 'Mazda', p_line_name => 'CX-30', p_color => 'gray', p_plate => 'PNA123',
       p_plate_city_code => %L) $$, pg_temp.id_of('pedro'), pg_temp.id_of('quiet'))),
  'vehicle_plate_city_not_issuing', 'CA-07: a car''s plate city must issue plates');
-- A car registered when its city still issued plates (as before this spec).
select pg_temp.remember('car', public.save_vehicle(
  p_customer_id => pg_temp.id_of('pedro')::uuid, p_vehicle_type => 'car', p_vehicle_class => 'automobile',
  p_brand_name => 'Mazda', p_line_name => 'CX-30', p_color => 'gray', p_plate => 'PNB123',
  p_plate_city_code => '11001')::text);
reset role;
update public.municipalities set issues_plates = false where code = '11001';
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000023a1');
select lives_ok(format($$ select public.save_vehicle(
       p_customer_id => %L::uuid, p_vehicle_type => 'car', p_vehicle_class => 'automobile',
       p_brand_name => 'Mazda', p_line_name => 'CX-30', p_color => 'red', p_plate => 'PNB123',
       p_plate_city_code => '11001', p_vehicle_id => %L::uuid) $$, pg_temp.id_of('pedro'), pg_temp.id_of('car')),
  'CA-08: a car keeps the city it had when another field is corrected');
select is(pg_temp.error_hint(format($$ select public.save_vehicle(
       p_customer_id => %L::uuid, p_vehicle_type => 'car', p_vehicle_class => 'automobile',
       p_brand_name => 'Mazda', p_line_name => 'CX-30', p_color => 'red', p_plate => 'PNB123',
       p_plate_city_code => %L, p_vehicle_id => %L::uuid) $$,
       pg_temp.id_of('pedro'), pg_temp.id_of('quiet'), pg_temp.id_of('car'))),
  'vehicle_plate_city_not_issuing', 'CA-08: but changing it, only to one that issues plates');
reset role;

select function_privs_are('public', 'set_plate_legend', array['text', 'text'], 'anon', array[]::text[],
  'CA-11: anonymous visitors cannot call it');

select * from finish();
rollback;
