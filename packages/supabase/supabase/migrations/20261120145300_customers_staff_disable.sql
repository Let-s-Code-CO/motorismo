-- Spec 004 (change of 2026-11-20): operators disable and reactivate customers too, not only admins
-- (RN-09, CA-29 to CA-32). A customer still never can (the RLS update policy already requires
-- disabled_at to stay null for them; the guard refuses it as well).
--
-- Replaces public.customers_guard() from 20261119192651_customers with the same body except the
-- RN-09 rule: is_staff() instead of is_admin(), and the hint customer_staff_only.
--
-- seeds: unchanged — no data changes

create or replace function public.customers_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_from_api boolean := current_user in ('authenticated', 'anon');
  v_phone text;
begin
  if tg_op = 'INSERT' and v_from_api then
    -- Staff register a customer at the counter (CA-24): everything but the contact data is set here.
    new.user_id := null;
    new.origin := 'counter';
    new.registered_by := (select auth.uid());
    new.consent_at := now();
    new.disabled_at := null;
    new.avatar_url := null;
  end if;

  if tg_op = 'UPDATE' then
    if new.id <> old.id
       or new.origin <> old.origin
       or new.registered_by is distinct from old.registered_by
       or new.consent_at <> old.consent_at
       or new.created_at <> old.created_at
       or (v_from_api and new.user_id is distinct from old.user_id) then
      raise exception 'customer identity columns are immutable'
        using errcode = 'check_violation', hint = 'customer_immutable_column';
    end if;

    if v_from_api then
      -- RN-10: the email of a customer with an account is the login: nobody changes it here.
      if old.user_id is not null and new.email is distinct from old.email then
        raise exception 'the email of a customer with an account cannot be changed'
          using errcode = 'insufficient_privilege', hint = 'customer_email_locked';
      end if;

      -- RN-09: staff (operator or admin) disable or reactivate; a customer never (CA-10, CA-31).
      if new.disabled_at is distinct from old.disabled_at then
        if not (select public.is_staff()) then
          raise exception 'only staff can disable or reactivate a customer'
            using errcode = 'insufficient_privilege', hint = 'customer_staff_only';
        end if;
        if new.disabled_at is not null then
          new.disabled_at := now();
        end if;
      end if;
    end if;
  end if;

  -- Normalisation (RN-01, RN-03).
  new.full_name := btrim(new.full_name);
  new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
  v_phone := nullif(btrim(coalesce(new.phone, '')), '');
  if v_phone is null then
    new.phone := null;
  else
    new.phone := private.normalize_mobile(v_phone);
    if new.phone is null then
      raise exception 'invalid mobile phone: %', v_phone
        using errcode = 'check_violation', hint = 'customer_phone_invalid';
    end if;
  end if;

  -- RN-01 / CA-26: one email, one person across staff and customers.
  if new.email is not null
     and (tg_op = 'INSERT' or new.email is distinct from old.email)
     and private.customer_email_taken(new.email, new.id) then
    raise exception 'email already in use: %', new.email
      using errcode = 'unique_violation', hint = 'customer_email_taken';
  end if;

  return new;
end;
$$;
