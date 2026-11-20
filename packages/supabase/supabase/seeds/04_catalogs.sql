-- Local catalogs for development and E2E tests (spec 007). Real services, prices and employees
-- are entered by an admin in each environment: these never leave the sandbox.
--
--   Services                 Moto      Carro     Bicicleta
--   Lavado sencillo          25.000    40.000    15.000
--   Lavado detallado         60.000    95.000    —
--   Micropulido              120.000   250.000   —
--   Recubrimiento cerámico   450.000   —         —
--   Polichado (disabled)     80.000    150.000   —
--
--   Employees                Document            Phone        Commission
--   Elkin Estrada            CC 1020304050       300 111 2233   35 %
--   Paula Pineda             CC 52123456         —              30 %
--   Diego Desactivado        CE 987654 (disabled) —             25 %

insert into public.services (name, price_motorcycle, price_car, price_bicycle) values
  ('Lavado sencillo', 25000, 40000, 15000),
  ('Lavado detallado', 60000, 95000, null),
  ('Micropulido', 120000, 250000, null),
  ('Recubrimiento cerámico', 450000, null, null),
  ('Polichado', 80000, 150000, null);

update public.services set disabled_at = now() - interval '30 days' where name = 'Polichado';

-- Saved through save_employee, as the app does (both tables, guard rules).
select public.save_employee('Elkin Estrada', 'cc', '1020304050', 35, p_phone => '3001112233');
select public.save_employee('Paula Pineda', 'cc', '52123456', 30);
select public.save_employee('Diego Desactivado', 'ce', '987654', 25);

update public.employees set disabled_at = now() - interval '60 days' where full_name = 'Diego Desactivado';
