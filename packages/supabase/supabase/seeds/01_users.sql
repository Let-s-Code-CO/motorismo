-- Local users for development and E2E tests (spec 002). Password for all: motorismo-local
--
--   sebastian.pulido@motorismo.test  admin     active
--   carlos.diaz@motorismo.test       admin     active
--   operador@motorismo.test          operator  active
--   desactivado@motorismo.test       operator  disabled (and banned in Auth)
--
-- Staff come only from a pending invitation (spec 004): the on_auth_user_created trigger builds
-- each profile from public.staff_invitations, never from raw_user_meta_data.
-- Token columns are '' rather than NULL because Auth cannot scan NULL into them.

insert into public.staff_invitations (email, full_name, role)
values
  ('sebastian.pulido@motorismo.test', 'Sebastián Pulido', 'admin'),
  ('carlos.diaz@motorismo.test', 'Carlos Díaz', 'admin'),
  ('operador@motorismo.test', 'Óscar Operador', 'operator'),
  ('desactivado@motorismo.test', 'Diana Desactivada', 'operator');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, banned_until,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change_token_current,
  email_change, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('motorismo-local', extensions.gen_salt('bf')), now(), u.banned_until,
  '{"provider":"email","providers":["email"]}',
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', '', '', '', '', ''
from (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'sebastian.pulido@motorismo.test', 'Sebastián Pulido', 'admin', null::timestamptz),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'carlos.diaz@motorismo.test', 'Carlos Díaz', 'admin', null),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'operador@motorismo.test', 'Óscar Operador', 'operator', null),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'desactivado@motorismo.test', 'Diana Desactivada', 'operator', now() + interval '100 years')
) as u (id, email, full_name, role, banned_until);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in (
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

-- All of them accepted their invitation (activated_at is set on invited → active); then one is disabled.
update public.profiles set status = 'active'
where id in (
  '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
);

update public.profiles set status = 'disabled'
where id = '33333333-3333-3333-3333-333333333333';
