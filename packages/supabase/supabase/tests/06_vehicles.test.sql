-- vehicles — the customers' motorcycles, bicycles and cars (spec 005).
--
-- A customer has zero or more vehicles; staff manage anyone's, a customer only their own. This
-- file guards:
--   * part A: the shape of vehicles, vehicle_brands and vehicle_lines (enums, composite foreign
--     keys, the partial unique index on the plate), RLS and privileges; the Colombian plate per
--     type (RN-02, RN-03: motorcycle ABC12D or ABC12, car ABC123, bicycle none), normalised to
--     uppercase without separators; class and displacement only where they belong (RN-09, RN-10,
--     CA-09); the line, required except on a bicycle; one active vehicle per plate (RN-04, CA-08);
--   * part B: save_vehicle resolves the brand and line by name, creating them only when they are
--     really new and never leaving one behind when the vehicle fails (CA-13, CA-14, RF-04, RF-05);
--     retiring frees the plate and is final (CA-20..CA-22, RN-07); the customer is fixed (RN-01);
--     a customer reads and changes only their own vehicles (CA-26); a disabled customer's vehicles
--     are read-only (spec assumption); the active plates feed the customer search (CA-17, CA-18).
begin;
create extension if not exists pgtap with schema extensions;

select plan(77);

-- Fixtures -------------------------------------------------------------------------------------
create function pg_temp.new_staff(p_id uuid, p_email text, p_name text, p_role text)
returns void language plpgsql as $$
begin
  insert into public.staff_invitations (email, full_name, role) values (p_email, p_name, p_role::public.user_role);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '', '{}');
  update public.profiles set status = 'active' where id = p_id;
end $$;

-- A confirmed customer account (the customer row is created on confirmation, spec 004).
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

-- Named ids shared across roles (customer ids are generated; vehicle ids come from save_vehicle).
create temp table t_ids (name text primary key, id uuid not null);
grant select, insert on t_ids to authenticated;

create function pg_temp.remember(p_name text, p_id uuid)
returns uuid language sql as $$
  insert into t_ids values (p_name, p_id) returning id;
$$;

create function pg_temp.id_of(p_name text)
returns uuid language sql stable as $$
  select id from t_ids where name = p_name;
$$;

-- The hint of the error a statement raises (null if it succeeds): the app maps hints to messages.
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

select pg_temp.new_staff('00000000-0000-0000-0000-0000000006a1', 'veh-admin@test.local', 'Ana Admin', 'admin');
select pg_temp.new_staff('00000000-0000-0000-0000-0000000006b1', 'veh-op@test.local', 'Oscar Operador', 'operator');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000006c1', 'camilo@test.local', 'Camilo Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000006c2', 'carla@test.local', 'Carla Cliente');
select pg_temp.new_customer('00000000-0000-0000-0000-0000000006d1', 'dario@test.local', 'Darío Desactivado');

select pg_temp.remember('camilo', (select id from public.customers where user_id = '00000000-0000-0000-0000-0000000006c1'));
select pg_temp.remember('carla', (select id from public.customers where user_id = '00000000-0000-0000-0000-0000000006c2'));
select pg_temp.remember('dario', (select id from public.customers where user_id = '00000000-0000-0000-0000-0000000006d1'));

-- Structure ----------------------------------------------------------------------------------------
select enum_has_labels('public', 'vehicle_type', array['motorcycle', 'bicycle', 'car'],
  'RF-02: vehicle types are motorcycle, bicycle and car');
select enum_has_labels('public', 'vehicle_class', array['automobile', 'utility', 'mountain', 'road'],
  'RN-10: classes are automobile and utility (car), mountain and road (bicycle)');
select enum_has_labels('public', 'vehicle_color',
  array['black', 'white', 'gray', 'silver', 'red', 'burgundy', 'blue', 'green', 'yellow', 'orange',
        'brown', 'beige', 'gold', 'purple', 'pink', 'multicolor'],
  'RN-05: the sixteen colours, in the order of the spec');
select has_table('public', 'vehicles', 'vehicles table exists');
select has_table('public', 'vehicle_brands', 'vehicle_brands table exists');
select has_table('public', 'vehicle_lines', 'vehicle_lines table exists');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.vehicles'::regclass, 'public.vehicle_brands'::regclass, 'public.vehicle_lines'::regclass)),
  'RLS is enabled on vehicles, vehicle_brands and vehicle_lines'
);
select policies_are('public', 'vehicles',
  array['vehicles_select_staff_or_own', 'vehicles_insert_staff_or_own', 'vehicles_update_staff_or_own'],
  'vehicles: select, insert and update for staff or the owner; no delete (RN-07)');
select policies_are('public', 'vehicle_brands', array['vehicle_brands_select_authenticated'],
  'vehicle_brands: read-only through the API');
select policies_are('public', 'vehicle_lines', array['vehicle_lines_select_authenticated'],
  'vehicle_lines: read-only through the API');
select ok(
  not has_table_privilege('anon', 'public.vehicles', 'SELECT')
  and not has_table_privilege('anon', 'public.vehicle_brands', 'SELECT')
  and not has_table_privilege('anon', 'public.vehicle_lines', 'SELECT'),
  'anon reads nothing: plates are personal data and the catalog needs a session'
);
select ok(
  not has_table_privilege('authenticated', 'public.vehicle_brands', 'INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated', 'public.vehicle_lines', 'INSERT, UPDATE, DELETE'),
  'the catalog only grows through save_vehicle, never written directly from the API'
);
select ok(
  not has_table_privilege('authenticated', 'public.vehicles', 'DELETE'),
  'RN-07: vehicles are never deleted, they are retired'
);
select ok(
  not has_column_privilege('authenticated', 'public.vehicles', 'customer_id', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.customers', 'vehicle_plates', 'UPDATE'),
  'RN-01: the API cannot move a vehicle to another customer nor write the plates of a customer'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'vehicles_plate_active_key'
          and indexdef like 'CREATE UNIQUE INDEX%' and indexdef like '%WHERE%retired_at IS NULL%'),
  'RN-04: the plate is unique among ACTIVE vehicles only (partial unique index)'
);
select fk_ok('public', 'vehicles', array['brand_id', 'vehicle_type'],
             'public', 'vehicle_brands', array['id', 'vehicle_type'],
  'RF-04: the brand belongs to the type of the vehicle');
select fk_ok('public', 'vehicles', array['line_id', 'brand_id'],
             'public', 'vehicle_lines', array['id', 'brand_id'],
  'RF-04: the line belongs to the brand of the vehicle');

-- Plates, classes, displacement and lines (staff through save_vehicle) ---------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000006b1');

select lives_ok(
  $$ select pg_temp.remember('camilo_moto', public.save_vehicle(
       p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki',
       p_line_name => 'GSX-R600', p_color => 'black', p_displacement_cc => 600, p_plate => 'qwe-45r')) $$,
  'staff register a motorcycle for a customer'
);
select results_eq(
  $$ select plate, displacement_cc::int, vehicle_class::text from public.vehicles where id = pg_temp.id_of('camilo_moto') $$,
  $$ values ('QWE45R', 600, null::text) $$,
  'CA-03: the plate is stored uppercase without separators ("qwe-45r" → QWE45R), with its displacement'
);
select lives_ok(
  $$ select pg_temp.remember('camilo_old_moto', public.save_vehicle(
       p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha',
       p_line_name => 'BWS FI', p_color => 'blue', p_plate => 'jwj 07')) $$,
  'RN-03: an old motorcycle plate, three letters and two digits ("jwj 07"), is valid'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha',
    p_line_name => 'BWS FI', p_color => 'blue', p_plate => 'ABC123') $$),
  'vehicle_plate_invalid',
  'CA-05: a car plate (ABC123) is rejected for a motorcycle'
);
select lives_ok(
  $$ select pg_temp.remember('carla_car', public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'utility',
       p_brand_name => 'Mazda', p_line_name => 'CX-30', p_color => 'gray', p_plate => 'abc123')) $$,
  'CA-05: a car (utility) with three letters and three digits is registered'
);
select is(
  (select plate from public.vehicles where id = pg_temp.id_of('carla_car')),
  'ABC123',
  'CA-05: the car plate is stored as ABC123'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'automobile',
    p_brand_name => 'Mazda', p_line_name => 'Mazda 3', p_color => 'red', p_plate => 'ABC12D') $$),
  'vehicle_plate_invalid',
  'CA-05: a motorcycle plate (ABC12D) is rejected for a car'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Honda',
    p_line_name => 'CB 190R', p_color => 'red') $$),
  'vehicle_plate_required',
  'CA-07: a motorcycle without plate is rejected'
);
select lives_ok(
  $$ select pg_temp.remember('carla_bike', public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'bicycle', p_vehicle_class => 'mountain',
       p_brand_name => 'GW', p_color => 'green', p_plate => 'XYZ12A', p_displacement_cc => 200)) $$,
  'CA-06: a bicycle is registered without a line'
);
select results_eq(
  $$ select plate, displacement_cc::int, line_id from public.vehicles where id = pg_temp.id_of('carla_bike') $$,
  $$ values (null::text, null::int, null::uuid) $$,
  'CA-06, CA-09: a bicycle keeps no plate, no displacement and no line'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_brand_name => 'Kia',
    p_line_name => 'Picanto', p_color => 'white', p_plate => 'KIA123') $$),
  'vehicle_class_required',
  'CA-07, RN-10: a car without class is rejected'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'mountain',
    p_brand_name => 'Kia', p_line_name => 'Picanto', p_color => 'white', p_plate => 'KIA123') $$),
  'vehicle_class_required',
  'RN-10: a car cannot have a bicycle class'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'bicycle', p_vehicle_class => 'automobile',
    p_brand_name => 'GW', p_color => 'white') $$),
  'vehicle_class_required',
  'RN-10: a bicycle cannot have a car class'
);
select lives_ok(
  $$ select pg_temp.remember('carla_moto', public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_vehicle_class => 'automobile',
       p_brand_name => 'Honda', p_line_name => 'CB 190R', p_color => 'red', p_plate => 'CRL19B',
       p_displacement_cc => 50)) $$,
  'RN-09: 50 cc is the lowest displacement accepted'
);
select results_eq(
  $$ select vehicle_class::text, displacement_cc::int from public.vehicles where id = pg_temp.id_of('carla_moto') $$,
  $$ values (null::text, 50) $$,
  'CA-09: a motorcycle keeps no class (a stale one from the form is dropped)'
);
select lives_ok(
  $$ select pg_temp.remember('carla_sedan', public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'automobile',
       p_brand_name => 'Kia', p_line_name => 'Picanto', p_color => 'white', p_plate => 'kia 123',
       p_displacement_cc => 1600)) $$,
  'a car (automobile) is registered'
);
select is(
  (select displacement_cc from public.vehicles where id = pg_temp.id_of('carla_sedan')),
  null,
  'CA-09, RN-09: a car keeps no displacement (a stale one from the form is dropped)'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Honda',
    p_line_name => 'Wave 110', p_color => 'red', p_plate => 'LOW49C', p_displacement_cc => 49) $$),
  'vehicle_displacement_invalid',
  'RN-09: 49 cc is below the range'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Honda',
    p_line_name => 'Wave 110', p_color => 'red', p_plate => 'BIG25C', p_displacement_cc => 2501) $$),
  'vehicle_displacement_invalid',
  'RN-09: 2501 cc is above the range'
);
select lives_ok(
  $$ select public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Triumph',
       p_line_name => 'Rocket 3', p_color => 'silver', p_plate => 'TOP25C', p_displacement_cc => 2500) $$,
  'RN-09: 2500 cc is the highest displacement accepted'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Honda',
    p_color => 'red', p_plate => 'NOL12N') $$),
  'vehicle_line_required',
  'CA-07: a motorcycle without line is rejected'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'automobile',
    p_brand_name => 'Kia', p_line_name => '   ', p_color => 'red', p_plate => 'NOL123') $$),
  'vehicle_line_required',
  'CA-07: a car with a blank line is rejected'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => '  ',
    p_line_name => 'X', p_color => 'red', p_plate => 'NOB12N') $$),
  'vehicle_brand_required',
  'CA-07: a vehicle without brand is rejected'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Bajaj',
    p_line_name => 'Pulsar NS 200', p_color => 'black', p_plate => 'QWE 45R') $$),
  'vehicle_plate_taken',
  'CA-08, RN-04: a plate with an active vehicle of another customer, written another way, is rejected'
);

-- Part B: the catalog grows only with really new names (CA-13, CA-14) -----------------------------
select lives_ok(
  $$ select pg_temp.remember('camilo_zeta', public.save_vehicle(
       p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'motorcycle', p_brand_name => '  Zeta  Motos ',
       p_line_name => 'ZX-10 Pro', p_color => 'orange', p_plate => 'ZET10Z')) $$,
  'CA-13: a vehicle with a brand and line that are not in the catalog is saved'
);
select results_eq(
  $$ select b.name, l.name from public.vehicles v
     join public.vehicle_brands b on b.id = v.brand_id join public.vehicle_lines l on l.id = v.line_id
     where v.id = pg_temp.id_of('camilo_zeta') $$,
  $$ values ('Zeta Motos', 'ZX-10 Pro') $$,
  'CA-13: the new brand and line join the catalog as written (trimmed, inner spaces collapsed)'
);
select lives_ok(
  $$ select pg_temp.remember('carla_zeta', public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'zeta-motos',
       p_line_name => 'zx10 pro', p_color => 'orange', p_plate => 'ZET11Z')) $$,
  'CA-14: the same brand and line written differently are accepted'
);
select results_eq(
  $$ select (select count(*)::int from public.vehicle_brands where vehicle_type = 'motorcycle' and name_key = 'zetamotos'),
            (select count(*)::int from public.vehicle_lines l join public.vehicle_brands b on b.id = l.brand_id
             where b.name_key = 'zetamotos' and l.name_key = 'zx10pro'),
            (select brand_id = (select brand_id from public.vehicles where id = pg_temp.id_of('camilo_zeta'))
             from public.vehicles where id = pg_temp.id_of('carla_zeta')) $$,
  $$ values (1, 1, true) $$,
  'CA-14, RN-06: no duplicate brand or line; the second vehicle uses the existing ones'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Marca Huérfana',
    p_line_name => 'Línea Huérfana', p_color => 'black', p_plate => 'QWE45R') $$),
  'vehicle_plate_taken',
  'a vehicle with a new brand but a taken plate fails...'
);
select is_empty(
  $$ select 1 from public.vehicle_brands where name_key = 'marcahuerfana' $$,
  '...and its new brand does not stay in the catalog (same transaction)'
);
select is(
  (select count(*)::int from public.vehicle_brands where name_key = 'zetamotos'),
  1,
  'RF-04: brands are per type (the motorcycle brand Zeta Motos exists once)'
);
select lives_ok(
  $$ select public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'car', p_vehicle_class => 'automobile',
       p_brand_name => 'Zeta Motos', p_line_name => 'Sedán Z', p_color => 'black', p_plate => 'ZET123') $$,
  'RF-04: a car can use a brand with the same name as a motorcycle brand...'
);
select is(
  (select count(*)::int from public.vehicle_brands where name_key = 'zetamotos'),
  2,
  '...which is a different catalog entry: one for each type'
);
reset role;

select throws_ok(
  format($$ insert into public.vehicles (customer_id, vehicle_type, vehicle_class, brand_id, line_id, color, plate)
            values (%L, 'car', 'automobile', %L, %L, 'black', 'FKB123') $$,
         pg_temp.id_of('carla'),
         (select brand_id from public.vehicles where id = pg_temp.id_of('camilo_moto')),
         (select line_id from public.vehicles where id = pg_temp.id_of('camilo_moto'))),
  '23503', null,
  'RF-04: a motorcycle brand cannot be used for a car (composite foreign key)'
);
select throws_ok(
  format($$ insert into public.vehicles (customer_id, vehicle_type, brand_id, line_id, color, plate)
            values (%L, 'motorcycle', %L, %L, 'black', 'FKL12L') $$,
         pg_temp.id_of('carla'),
         (select brand_id from public.vehicles where id = pg_temp.id_of('camilo_moto')),
         (select line_id from public.vehicles where id = pg_temp.id_of('camilo_old_moto'))),
  '23503', null,
  'RF-04: a line of another brand cannot be used (composite foreign key)'
);

-- Editing and retiring (CA-20 to CA-22) --------------------------------------------------------
set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000006b1');

select lives_ok(
  $$ select public.save_vehicle(
       p_vehicle_id => pg_temp.id_of('carla_moto'), p_customer_id => pg_temp.id_of('carla'),
       p_vehicle_type => 'motorcycle', p_brand_name => 'honda', p_line_name => 'cb 190r', p_color => 'purple',
       p_plate => 'CRL19B', p_displacement_cc => 190) $$,
  'CA-20: staff correct a vehicle through save_vehicle'
);
select results_eq(
  $$ select color::text, displacement_cc::int from public.vehicles where id = pg_temp.id_of('carla_moto') $$,
  $$ values ('purple', 190) $$,
  'CA-20: the vehicle shows the new data'
);
select is(
  pg_temp.error_hint(format($$ update public.vehicles set plate = 'QWE45R' where id = %L $$, pg_temp.id_of('carla_moto'))),
  'vehicle_plate_taken',
  'CA-20: correcting the plate to one of another active vehicle is rejected'
);
select is(
  pg_temp.error_hint(format($$ select public.save_vehicle(
    p_vehicle_id => %L, p_customer_id => %L, p_vehicle_type => 'motorcycle', p_brand_name => 'Honda',
    p_line_name => 'CB 190R', p_color => 'red', p_plate => 'CRL19B') $$,
    pg_temp.id_of('carla_moto'), pg_temp.id_of('camilo'))),
  'vehicle_not_found',
  'RN-01: save_vehicle cannot edit a vehicle as if it belonged to another customer'
);
select results_eq(
  format($$ with retired as (update public.vehicles set retired_at = '2000-01-01' where id = %L returning retired_at)
            select retired_at > now() - interval '1 minute' from retired $$, pg_temp.id_of('camilo_old_moto')),
  $$ values (true) $$,
  'CA-21: staff retire a vehicle; the retirement date is now, whatever the caller sent'
);
select lives_ok(
  $$ select public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha',
       p_line_name => 'BWS FI', p_color => 'blue', p_plate => 'JWJ-07') $$,
  'CA-21, RN-04: the plate of a retired vehicle is free for another customer'
);
select is(
  pg_temp.error_hint(format($$ update public.vehicles set color = 'red' where id = %L $$, pg_temp.id_of('camilo_old_moto'))),
  'vehicle_retired',
  'CA-22: a retired vehicle cannot be edited'
);
select is(
  pg_temp.error_hint(format($$ update public.vehicles set retired_at = null where id = %L $$, pg_temp.id_of('camilo_old_moto'))),
  'vehicle_retired',
  'CA-22, RN-07: a retirement cannot be undone'
);
select throws_ok(
  format($$ update public.vehicles set customer_id = %L where id = %L $$, pg_temp.id_of('carla'), pg_temp.id_of('camilo_moto')),
  '42501', null,
  'RN-01: the API cannot move a vehicle to another customer (no column privilege)'
);
reset role;
select is(
  pg_temp.error_hint(format($$ update public.vehicles set customer_id = %L where id = %L $$,
                            pg_temp.id_of('carla'), pg_temp.id_of('camilo_moto'))),
  'vehicle_immutable_column',
  'RN-01: not even the database owner moves a vehicle to another customer (guard)'
);

-- The customer search sees the active plates (CA-17, CA-18) --------------------------------------
select is(
  (select array(select unnest(string_to_array(vehicle_plates, ' ')) order by 1)
   from public.customers where id = pg_temp.id_of('camilo')),
  array['QWE45R', 'ZET10Z'],
  'CA-17, CA-18: a customer record lists its active plates, without the retired JWJ07'
);
select ok(
  (select search_text like '%qwe45r%' and search_text not like '%jwj07%'
   from public.customers where id = pg_temp.id_of('camilo')),
  'CA-17, CA-18: the customer search text has the active plates and not the retired one'
);

-- What a customer can do (CA-26) ------------------------------------------------------------------
-- Darío's motorcycle exists before he is disabled; then he is disabled (spec 004, by an admin).
select pg_temp.remember('dario_moto', public.save_vehicle(
  p_customer_id => pg_temp.id_of('dario'), p_vehicle_type => 'motorcycle', p_brand_name => 'AKT',
  p_line_name => 'NKD 125', p_color => 'red', p_plate => 'DAR12D'));
update public.customers set disabled_at = now() where id = pg_temp.id_of('dario');

set local role authenticated;
select pg_temp.act_as('00000000-0000-0000-0000-0000000006c1');

select results_eq(
  $$ select count(*)::int from public.vehicles $$,
  $$ select count(*)::int from public.vehicles where customer_id = pg_temp.id_of('camilo') $$,
  'CA-26: a customer reads only their own vehicles'
);
select is(
  (select count(*)::int from public.vehicles),
  3,
  'CA-26: ...which are their three (two active and the retired one)'
);
select lives_ok(
  $$ select pg_temp.remember('camilo_bike', public.save_vehicle(
       p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'bicycle', p_vehicle_class => 'road',
       p_brand_name => 'Specialized', p_line_name => 'Tarmac', p_color => 'white')) $$,
  'HU-06: a customer registers a vehicle of their own'
);
select throws_ok(
  $$ select public.save_vehicle(
       p_customer_id => pg_temp.id_of('carla'), p_vehicle_type => 'bicycle', p_vehicle_class => 'road',
       p_brand_name => 'Specialized', p_color => 'white') $$,
  '42501', null,
  'CA-26: a customer cannot register a vehicle for another customer'
);
select is(
  pg_temp.error_hint(format($$ select public.save_vehicle(
    p_vehicle_id => %L, p_customer_id => %L, p_vehicle_type => 'motorcycle', p_brand_name => 'Honda',
    p_line_name => 'CB 190R', p_color => 'black', p_plate => 'CRL19B') $$,
    pg_temp.id_of('carla_moto'), pg_temp.id_of('camilo'))),
  'vehicle_not_found',
  'CA-26: a customer cannot edit the vehicle of another customer through save_vehicle'
);
select results_eq(
  format($$ with changed as (update public.vehicles set retired_at = now() where id = %L returning 1)
            select count(*)::int from changed $$, pg_temp.id_of('carla_moto')),
  $$ values (0) $$,
  'CA-26: a customer cannot retire the vehicle of another customer (no row is visible to change)'
);
select results_eq(
  format($$ with retired as (update public.vehicles set retired_at = now() where id = %L returning 1)
            select count(*)::int from retired $$, pg_temp.id_of('camilo_bike')),
  $$ values (1) $$,
  'CA-24: a customer retires a vehicle of their own'
);
select is(
  pg_temp.error_hint($$ select public.save_vehicle(
    p_customer_id => pg_temp.id_of('camilo'), p_vehicle_type => 'car', p_vehicle_class => 'automobile',
    p_brand_name => 'Mazda', p_line_name => 'Mazda 3', p_color => 'red', p_plate => 'ABC 123') $$),
  'vehicle_plate_taken',
  'CA-25, RN-08: a customer learns that a plate is taken, and nothing else'
);
select ok(
  (select count(*) > 0 from public.vehicle_brands),
  'a customer reads the catalog (it is not personal data)'
);
select throws_ok(
  $$ insert into public.vehicle_brands (vehicle_type, name) values ('motorcycle', 'Directa') $$,
  '42501', null,
  'a customer cannot write the catalog directly'
);

-- A disabled customer's vehicles are read-only, even for staff (spec assumption) ----------------
select pg_temp.act_as('00000000-0000-0000-0000-0000000006b1');
select throws_ok(
  $$ select public.save_vehicle(
       p_customer_id => pg_temp.id_of('dario'), p_vehicle_type => 'bicycle', p_vehicle_class => 'road',
       p_brand_name => 'GW', p_color => 'white') $$,
  '42501', null,
  'staff cannot add a vehicle to a disabled customer'
);
select results_eq(
  format($$ with changed as (update public.vehicles set color = 'blue' where id = %L returning 1)
            select count(*)::int from changed $$, pg_temp.id_of('dario_moto')),
  $$ values (0) $$,
  'staff cannot change the vehicles of a disabled customer'
);
select results_eq(
  $$ select count(*)::int from public.vehicles where customer_id = pg_temp.id_of('dario') $$,
  $$ values (1) $$,
  'staff still see the vehicles of a disabled customer'
);
reset role;

select * from finish();
rollback;
