-- Local catalogs for development and E2E tests (spec 007). Employees are entered by an admin in each
-- environment: these never leave the sandbox. The motorcycle services are the business's price list,
-- loaded by migration in every environment (spec 024, CA-17); here only examples for the car and the
-- bicycle of the seeds, which the list does not cover:
--
--   Services                 Carro     Bicicleta
--   Lavado sencillo          40.000    15.000
--   Lavado detallado         95.000    —
--   Micropulido              250.000   —
--   Polichado (disabled)     150.000   —
--
--   Employees                Document            Phone          Commission  Base salary (spec 016)
--   Elkin Estrada            CC 1020304050       300 111 2233   35 %        1.423.500
--   Paula Pineda             CC 52123456         —              30 %        1.300.000
--   Diego Desactivado        CE 987654 (disabled) —             25 %        900.000
--
--   All registered 90 days ago; Diego disabled 20 days ago, so the month before has part of his
--   base salary (spec 016, RN-04).

insert into public.services (name, price_car, price_bicycle) values
  ('Lavado sencillo', 40000, 15000),
  ('Lavado detallado', 95000, null),
  ('Micropulido', 250000, null),
  ('Polichado', 150000, null);

update public.services set disabled_at = now() - interval '30 days' where name = 'Polichado';

-- Saved through save_employee, as the app does (both tables, guard rules).
select public.save_employee('Elkin Estrada', 'cc', '1020304050', 35, p_phone => '3001112233', p_base_salary => 1423500);
select public.save_employee('Paula Pineda', 'cc', '52123456', 30, p_base_salary => 1300000);
select public.save_employee('Diego Desactivado', 'ce', '987654', 25, p_base_salary => 900000);

-- Registered 90 days ago, active since (spec 016); Diego disabled 20 days ago (the trigger closes his period).
update public.employees set created_at = now() - interval '90 days' where created_at > now() - interval '1 minute';
update public.employee_active_periods set started_at = now() - interval '90 days' where started_at > now() - interval '1 minute';
update public.employees set disabled_at = now() - interval '20 days' where full_name = 'Diego Desactivado';

-- Estimated times (spec 008, HU-06).
update public.services set estimated_minutes = 30 where name = 'Lavado sencillo';
update public.services set estimated_minutes = 90 where name = 'Lavado detallado';
update public.services set estimated_minutes = 120 where name = 'Micropulido';
