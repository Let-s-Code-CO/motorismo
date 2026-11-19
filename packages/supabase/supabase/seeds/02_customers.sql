-- Local customers for development and E2E tests (spec 004). Password for those with one: motorismo-local
--
--   cliente@motorismo.test               with account (own sign-up), phone 300 123 4567 — test customer
--   cliente.google@motorismo.test        with account (Google), with photo, no phone
--   cliente.desactivado@motorismo.test   with account, disabled (and banned in Auth)
--   Valentina Vásquez                    without account (counter), email + phone
--   Andrés Ñáñez                         without account (counter), phone only
--
-- Customers with an account are created by the on_auth_user_customer_sync trigger when the auth
-- user arrives confirmed; counter customers are inserted directly (registered by the first admin).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, banned_until,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  email_change, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  case when u.provider = 'email' then extensions.crypt('motorismo-local', extensions.gen_salt('bf')) else '' end,
  now(), u.banned_until,
  jsonb_build_object('provider', u.provider, 'providers', jsonb_build_array(u.provider)),
  u.meta, now(), now(),
  '', '', '', '', '', '', '', ''
from (
  values
    ('55555555-5555-5555-5555-555555555551'::uuid, 'cliente@motorismo.test', 'email',
     '{"full_name":"Camila Cliente","phone":"3001234567","data_consent":true}'::jsonb, null::timestamptz),
    ('55555555-5555-5555-5555-555555555552'::uuid, 'cliente.google@motorismo.test', 'google',
     '{"full_name":"Gabriel Gómez","avatar_url":"https://api.dicebear.com/9.x/notionists/png?seed=Gabriel"}'::jsonb, null),
    ('55555555-5555-5555-5555-555555555553'::uuid, 'cliente.desactivado@motorismo.test', 'email',
     '{"full_name":"Daniel Desactivado","phone":"3109876543","data_consent":true}'::jsonb, now() + interval '100 years')
) as u (id, email, provider, meta, banned_until);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  case when u.raw_app_meta_data ->> 'provider' = 'google' then 'google-seed-gabriel' else u.id::text end,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true)
    || case when u.raw_app_meta_data ->> 'provider' = 'google'
            then jsonb_build_object('full_name', 'Gabriel Gómez',
                                    'avatar_url', 'https://api.dicebear.com/9.x/notionists/png?seed=Gabriel')
            else '{}'::jsonb end,
  u.raw_app_meta_data ->> 'provider', now(), now(), now()
from auth.users u
where u.id in (
  '55555555-5555-5555-5555-555555555551',
  '55555555-5555-5555-5555-555555555552',
  '55555555-5555-5555-5555-555555555553'
);

update public.customers set disabled_at = now()
where user_id = '55555555-5555-5555-5555-555555555553';

insert into public.customers (full_name, email, phone, origin, registered_by)
values
  ('Valentina Vásquez', 'valentina.vasquez@correo.test', '3157654321', 'counter', '11111111-1111-1111-1111-111111111111'),
  ('Andrés Ñáñez', null, '3209998877', 'counter', '11111111-1111-1111-1111-111111111111');
