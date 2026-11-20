-- Local vehicles for development and E2E tests (spec 005), on the customers of 02_customers.sql:
--
--   Camila Cliente (cliente@)        Suzuki GSX-R600, 600 cc, black, UIH-03D (active)
--                                    Yamaha BWS FI, blue, JWJ-07 (retired: shows "Vehículos retirados")
--   Valentina Vásquez (no account)   Mazda CX-30, "Camioneta", gray, KDM-482, Bogotá, D.C.
--   Andrés Ñáñez (no account)        GW "Montaña" bicycle, green, no plate
--   Daniel Desactivado (disabled)    AKT NKD 125, red, DAN-12D (read-only while disabled)
--
-- Saved through save_vehicle, as the app does (catalog lookup by name, guard rules).

select public.save_vehicle(
  p_customer_id => (select id from public.customers where email = 'cliente@motorismo.test'),
  p_vehicle_type => 'motorcycle', p_brand_name => 'Yamaha', p_line_name => 'BWS FI',
  p_color => 'blue', p_plate => 'JWJ07');

update public.vehicles set retired_at = now() where plate = 'JWJ07';

select public.save_vehicle(
  p_customer_id => (select id from public.customers where email = 'cliente@motorismo.test'),
  p_vehicle_type => 'motorcycle', p_brand_name => 'Suzuki', p_line_name => 'GSX-R600',
  p_displacement_cc => 600, p_color => 'black', p_plate => 'UIH03D');

select public.save_vehicle(
  p_customer_id => (select id from public.customers where email = 'valentina.vasquez@correo.test'),
  p_vehicle_type => 'car', p_vehicle_class => 'utility', p_brand_name => 'Mazda', p_line_name => 'CX-30',
  p_color => 'gray', p_plate => 'KDM482', p_plate_city_code => '11001');

select public.save_vehicle(
  p_customer_id => (select id from public.customers where full_name = 'Andrés Ñáñez'),
  p_vehicle_type => 'bicycle', p_vehicle_class => 'mountain', p_brand_name => 'GW', p_color => 'green');

-- Daniel is disabled in 02_customers.sql; as the database owner the seed may still give him one.
select public.save_vehicle(
  p_customer_id => (select id from public.customers where email = 'cliente.desactivado@motorismo.test'),
  p_vehicle_type => 'motorcycle', p_brand_name => 'AKT', p_line_name => 'NKD 125',
  p_color => 'red', p_plate => 'DAN12D');
