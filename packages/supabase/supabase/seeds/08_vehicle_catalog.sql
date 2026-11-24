-- Local catalog entries to review in «Marcas y líneas» (spec 018), «added» as if someone had typed
-- them registering a vehicle (save_vehicle adds them the same way):
--
--   Motorcycle   «Yamaja» with the line «Fz 2.0»   a typo of Yamaha: to merge (HU-03)
--   Motorcycle   Honda → «Fz 2.0»                   a line under the wrong brand: to move (HU-04)
--
-- Without vehicles: the seed customers keep the vehicles the other seeds and the E2E rely on (a
-- customer with a single vehicle gets it preselected, spec 008, RN-10).

select private.ensure_vehicle_line(private.ensure_vehicle_brand('motorcycle', 'Yamaja'), 'Fz 2.0');

select private.ensure_vehicle_line(
  (select id from public.vehicle_brands where vehicle_type = 'motorcycle' and name = 'Honda'), 'Fz 2.0');
