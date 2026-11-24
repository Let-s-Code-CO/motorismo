-- Local data requests (spec 017), through the same functions as the app:
--
--   Camila (cliente@)       corrección, pedida en la app hoy          «Recibida», vence en 15 días hábiles
--   Valentina (sin cuenta)  consulta, en el punto de atención         «Recibida» hace 16 días: vencida

-- Camila asks from the app.
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'cliente@motorismo.test'),
                    'role', 'authenticated')::text, true);
select public.request_data_change('correction',
  'Mi correo cambió: ahora uso camila.nueva@correo.test. Por favor actualícenlo.');

-- The first admin registers Valentina's inquiry at the counter…
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from auth.users where email = 'sebastian.pulido@motorismo.test'),
                    'role', 'authenticated')::text, true);
select public.register_data_request(
  (select id from public.customers where full_name = 'Valentina Vásquez'), 'inquiry', 'counter',
  'Pidió en el punto de atención saber qué datos suyos guardamos.');
select set_config('request.jwt.claims', null, true);

-- …16 days ago: overdue (10 business days).
update public.data_requests r
   set received_at = now() - interval '16 days',
       due_on = private.add_business_days(((now() - interval '16 days') at time zone 'America/Bogota')::date, 10)
 where r.kind = 'inquiry'
   and r.customer_id = (select id from public.customers where full_name = 'Valentina Vásquez');
