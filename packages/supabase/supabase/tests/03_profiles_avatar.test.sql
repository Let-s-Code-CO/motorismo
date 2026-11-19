-- profiles.avatar_url — the Google photo on the avatar (spec 002, CA-30).
--
-- Guards:
--   * linking a Google identity copies its photo (identity_data.avatar_url, or .picture);
--   * every later Google sign-in (Auth updates identity_data) refreshes it;
--   * the "email" identity never touches it;
--   * only https URLs are stored (anything else is ignored), so the app never renders e.g. a
--     javascript: or http: URL;
--   * users cannot write it through the API (the column is not updatable by authenticated).
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

create function pg_temp.new_user(p_id uuid, p_email text)
returns void language plpgsql as $$
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
  values (p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', p_email, '',
          '{"full_name":"Gina Google","role":"operator"}');
end $$;

select pg_temp.new_user('00000000-0000-0000-0000-0000000000d1', 'gina@test.local');

insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('gina-email', '00000000-0000-0000-0000-0000000000d1',
        '{"email":"gina@test.local","avatar_url":"https://example.com/not-from-email.png"}', 'email');
select is(
  (select avatar_url from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  null,
  'the email identity does not set a photo'
);

insert into auth.identities (provider_id, user_id, identity_data, provider)
values ('gina-google', '00000000-0000-0000-0000-0000000000d1',
        '{"email":"gina@test.local","avatar_url":"https://lh3.googleusercontent.com/a/first"}', 'google');
select is(
  (select avatar_url from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'https://lh3.googleusercontent.com/a/first',
  'linking Google copies its photo (CA-30)'
);

update auth.identities
set identity_data = '{"email":"gina@test.local","avatar_url":"https://lh3.googleusercontent.com/a/second"}'
where provider_id = 'gina-google';
select is(
  (select avatar_url from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'https://lh3.googleusercontent.com/a/second',
  'a later Google sign-in refreshes the photo (CA-30)'
);

update auth.identities
set identity_data = '{"email":"gina@test.local","picture":"https://lh3.googleusercontent.com/a/picture"}'
where provider_id = 'gina-google';
select is(
  (select avatar_url from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'https://lh3.googleusercontent.com/a/picture',
  'falls back to the "picture" field when there is no avatar_url'
);

update auth.identities
set identity_data = '{"email":"gina@test.local","avatar_url":"javascript:alert(1)"}'
where provider_id = 'gina-google';
select is(
  (select avatar_url from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'),
  'https://lh3.googleusercontent.com/a/picture',
  'a non-https URL is ignored and the previous photo is kept'
);

select throws_ok(
  $$ update public.profiles set avatar_url = 'http://insecure.example.com/x.png'
     where id = '00000000-0000-0000-0000-0000000000d1' $$,
  '23514', null,
  'the table itself rejects non-https photo URLs'
);

select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE'),
  'users cannot write avatar_url through the API'
);

select * from finish();
rollback;
