-- Spec 002, CA-30 — the Google photo on the user's avatar.
--
-- avatar_url mirrors the photo of the user's OAuth identity (Google). It is written only by the
-- trigger below — users cannot update it through the API (no column privilege) — and only https
-- URLs are accepted, so the app never renders another scheme.
--
-- seeds: unchanged — local seed users sign in with email and have no photo.

alter table public.profiles
  add column avatar_url text
    constraint profiles_avatar_url_https check (avatar_url is null or avatar_url ~ '^https://');

comment on column public.profiles.avatar_url is
  'Photo of the linked OAuth identity (e.g. Google), refreshed on every OAuth sign-in. https only.';

create function public.sync_profile_avatar_from_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := coalesce(new.identity_data ->> 'avatar_url', new.identity_data ->> 'picture');
begin
  -- The email identity has no photo; anything that is not https is ignored (previous photo kept).
  if new.provider = 'email' or v_url is null or v_url !~ '^https://' then
    return new;
  end if;

  update public.profiles
  set avatar_url = v_url
  where id = new.user_id
    and avatar_url is distinct from v_url;

  return new;
end;
$$;

-- On linking (insert) and on every OAuth sign-in, when Auth refreshes identity_data (update).
create trigger on_auth_identity_avatar
  after insert or update of identity_data on auth.identities
  for each row execute function public.sync_profile_avatar_from_identity();
