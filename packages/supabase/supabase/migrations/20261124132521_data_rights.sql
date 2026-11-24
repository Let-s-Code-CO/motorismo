-- Spec 017 — the rights of the data subject: a customer's requests about their data, and erasing it.
--
-- * Business days (RN-03): Colombian holidays for any year (Law 51 of 1983: fixed, moved to the next
--   Monday, and by Easter), and deadlines counted in business days from the day after.
-- * data_requests: inquiries, corrections and erasures, by the app (the customer) or registered by
--   an admin (counter, Instagram). Read with RLS (the admin, all; a customer, theirs) and written only
--   by the functions below, once to a final state (RN-01, RN-02, CA-19).
-- * customer_data_json: everything the business keeps of a customer, nothing internal (CA-01, CA-03).
-- * erase_customer_data: anonymises a customer in one transaction, keeping their orders without
--   personal data (RN-05 to RN-07). vehicles_guard lets that transaction remove plates of retired
--   vehicles; customers_contact_required lets an erased customer have no contact.
--
-- seeds: 07_data_requests.sql adds a correction from Camila and an overdue inquiry of Valentina.

-- Business days (RN-03) --------------------------------------------------------------------------------
create function private.easter_sunday(p_year integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  -- Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  a integer := p_year % 19;
  b integer := p_year / 100;
  c integer := p_year % 100;
  d integer := b / 4;
  e integer := b % 4;
  f integer := (b + 8) / 25;
  g integer := (b - f + 1) / 3;
  h integer := (19 * a + b - d - g + 15) % 30;
  i integer := c / 4;
  k integer := c % 4;
  l integer := (32 + 2 * e + 2 * i - h - k) % 7;
  m integer := (a + 11 * h + 22 * l) / 451;
begin
  return make_date(p_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- The day itself if it is a Monday, else the next Monday (Law 51 of 1983, «Ley Emiliani»).
create function private.next_monday(p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_day + ((8 - extract(isodow from p_day)::integer) % 7);
$$;

create function private.colombian_holidays(p_year integer)
returns setof date
language sql
immutable
set search_path = ''
as $$
  with easter as (select private.easter_sunday(p_year) as day)
  select make_date(p_year, month, day) from (values (1, 1), (5, 1), (7, 20), (8, 7), (12, 8), (12, 25)) fixed(month, day)
  union
  select private.next_monday(make_date(p_year, month, day))
  from (values (1, 6), (3, 19), (6, 29), (8, 15), (10, 12), (11, 1), (11, 11)) moved(month, day)
  union
  select easter.day - 3 from easter            -- Holy Thursday
  union
  select easter.day - 2 from easter            -- Good Friday
  union
  select private.next_monday(easter.day + 39) from easter  -- Ascension
  union
  select private.next_monday(easter.day + 60) from easter  -- Corpus Christi
  union
  select private.next_monday(easter.day + 68) from easter; -- Sacred Heart
$$;

create function private.is_business_day(p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extract(isodow from p_day) < 6
     and p_day not in (select private.colombian_holidays(extract(year from p_day)::integer));
$$;

-- The p_days-th business day after p_from (counting from the day after, RN-03).
create function private.add_business_days(p_from date, p_days integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_day date := p_from;
  v_left integer := p_days;
begin
  while v_left > 0 loop
    v_day := v_day + 1;
    if private.is_business_day(v_day) then
      v_left := v_left - 1;
    end if;
  end loop;
  return v_day;
end;
$$;

-- Business days after p_from up to p_to, both ways counted from the day after (0 if none).
create function private.business_days_between(p_from date, p_to date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_from + 1, p_to, interval '1 day') d(day)
  where private.is_business_day(d.day::date);
$$;

grant execute on function private.easter_sunday(integer), private.next_monday(date),
  private.colombian_holidays(integer), private.is_business_day(date), private.add_business_days(date, integer),
  private.business_days_between(date, date) to authenticated, service_role;

-- Requests ----------------------------------------------------------------------------------------------
create type public.data_request_kind as enum ('inquiry', 'correction', 'erasure');
create type public.data_request_channel as enum ('app', 'counter', 'instagram');
create type public.data_request_status as enum ('received', 'attended', 'rejected', 'withdrawn');

create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  kind public.data_request_kind not null,
  channel public.data_request_channel not null,
  description text check (char_length(description) <= 1000),
  status public.data_request_status not null default 'received',
  received_at timestamptz not null,
  due_on date not null,
  -- Whoever sent it: the customer (app) or the admin who registered it. Not a foreign key: an
  -- erased customer's account is gone, the request stays (CA-20).
  created_by uuid not null,
  resolved_by uuid,
  resolved_at timestamptz,
  response text check (char_length(response) <= 1000),
  constraint data_requests_resolved_consistent check (
    (status = 'received') = (resolved_at is null and resolved_by is null)
  )
);

-- RN-02: one open request per kind and customer.
create unique index data_requests_one_open on public.data_requests (customer_id, kind) where status = 'received';
create index data_requests_customer_idx on public.data_requests (customer_id);

comment on table public.data_requests is
  'Requests of the data subject (spec 017): written only by its functions, never deleted.';

alter table public.data_requests enable row level security;
create policy data_requests_select_admin_or_own on public.data_requests for select to authenticated
  using ((select public.is_admin()) or customer_id = (select private.current_customer_id()));
revoke all on table public.data_requests from anon, authenticated;
grant select on table public.data_requests to authenticated;

-- An erased customer has no contact, and is marked so.
alter table public.customers add column erased_at timestamptz;
alter table public.customers drop constraint customers_contact_required;
alter table public.customers add constraint customers_contact_required
  check (email is not null or phone is not null or erased_at is not null);

-- The list (CA-09): with the customer's name, business days left and overdue. Applies the RLS of
-- the table.
create view public.data_request_summaries
with (security_invoker = true)
as
select r.id, r.customer_id, c.full_name as customer_name, c.user_id is not null as customer_has_account,
       c.origin as customer_origin, c.erased_at is not null as customer_erased,
       r.kind, r.channel, r.description, r.status, r.received_at, r.due_on, r.created_by, r.resolved_by,
       r.resolved_at, r.response,
       (select p.full_name from public.profiles p where p.id = r.resolved_by) as resolved_by_name,
       case when r.status = 'received'
            then private.business_days_between(private.business_today(), r.due_on) end as business_days_left,
       r.status = 'received' and private.business_today() > r.due_on as overdue
from public.data_requests r
join public.customers c on c.id = r.customer_id;

revoke all on public.data_request_summaries from anon, authenticated;
grant select on public.data_request_summaries to authenticated;

-- Helpers ----------------------------------------------------------------------------------------------
create function private.require_admin_for_data_requests()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'only an admin handles data requests' using errcode = '42501', hint = 'data_request_admin_only';
  end if;
end;
$$;

-- The active customer of this session, or an error.
create function private.require_active_customer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select c.id into v_id from public.customers c
  where c.user_id = (select auth.uid()) and c.disabled_at is null;
  if v_id is null then
    raise exception 'only a customer sends their requests' using errcode = '42501', hint = 'data_request_customer_only';
  end if;
  return v_id;
end;
$$;

create function private.new_data_request(
  p_customer uuid, p_kind public.data_request_kind, p_channel public.data_request_channel, p_description text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.data_requests r
             where r.customer_id = p_customer and r.kind = p_kind and r.status = 'received') then
    raise exception 'a request of this kind is already open' using hint = 'data_request_open';
  end if;
  insert into public.data_requests (customer_id, kind, channel, description, received_at, due_on, created_by)
  values (p_customer, p_kind, p_channel, p_description, private.agenda_now(),
          -- RN-03: an inquiry, 10 business days; a correction or an erasure (claims), 15.
          private.add_business_days(private.business_today(), case p_kind when 'inquiry' then 10 else 15 end),
          (select auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

-- The request, locked, if it is still open.
create function private.open_data_request(p_id uuid)
returns public.data_requests
language plpgsql
set search_path = ''
as $$
declare
  v_request public.data_requests;
begin
  select * into v_request from public.data_requests where id = p_id for update;
  if not found then
    raise exception 'request not found' using hint = 'data_request_not_found';
  end if;
  if v_request.status <> 'received' then
    raise exception 'the request is closed' using hint = 'data_request_closed';
  end if;
  return v_request;
end;
$$;

revoke all on function private.require_admin_for_data_requests(), private.require_active_customer(),
  private.new_data_request(uuid, public.data_request_kind, public.data_request_channel, text),
  private.open_data_request(uuid) from public;

-- The customer (HU-02) ----------------------------------------------------------------------------------
create function public.request_data_change(p_kind public.data_request_kind, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := private.require_active_customer();
  v_description text := nullif(btrim(p_description), '');
begin
  if p_kind not in ('correction', 'erasure') then
    raise exception 'a customer asks for a correction or an erasure' using hint = 'data_request_kind_invalid';
  end if;
  if p_kind = 'correction' and v_description is null then
    raise exception 'say what to correct' using hint = 'data_request_description_required';
  end if;
  return private.new_data_request(v_customer, p_kind, 'app', v_description);
end;
$$;

create function public.withdraw_data_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer uuid := private.require_active_customer();
begin
  if not exists (select 1 from public.data_requests r where r.id = p_id and r.customer_id = v_customer) then
    raise exception 'request not found' using hint = 'data_request_not_found';
  end if;
  perform private.open_data_request(p_id);
  update public.data_requests
     set status = 'withdrawn', resolved_by = (select auth.uid()), resolved_at = private.agenda_now()
   where id = p_id;
end;
$$;

-- The admin (HU-03, HU-04) ------------------------------------------------------------------------------
create function public.register_data_request(
  p_customer uuid, p_kind public.data_request_kind, p_channel public.data_request_channel, p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_description text := nullif(btrim(p_description), '');
begin
  perform private.require_admin_for_data_requests();
  if p_channel not in ('counter', 'instagram') then
    raise exception 'the admin registers what came by the counter or Instagram' using hint = 'data_request_channel_invalid';
  end if;
  if v_description is null then
    raise exception 'say what was asked' using hint = 'data_request_description_required';
  end if;
  if not exists (select 1 from public.customers c where c.id = p_customer and c.erased_at is null) then
    raise exception 'customer not found' using hint = 'data_request_customer_not_found';
  end if;
  return private.new_data_request(p_customer, p_kind, p_channel, v_description);
end;
$$;

create function public.resolve_data_request(p_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.data_requests;
  v_response text := nullif(btrim(p_response), '');
begin
  perform private.require_admin_for_data_requests();
  if v_response is null then
    raise exception 'write the answer' using hint = 'data_request_response_required';
  end if;
  v_request := private.open_data_request(p_id);
  if v_request.kind = 'erasure' then
    raise exception 'an erasure is attended by erasing' using hint = 'data_request_wrong_kind';
  end if;
  update public.data_requests
     set status = 'attended', resolved_by = (select auth.uid()), resolved_at = private.agenda_now(),
         response = v_response
   where id = p_id;
end;
$$;

create function public.reject_data_request(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform private.require_admin_for_data_requests();
  if v_reason is null then
    raise exception 'write the reason' using hint = 'data_request_response_required';
  end if;
  perform private.open_data_request(p_id);
  update public.data_requests
     set status = 'rejected', resolved_by = (select auth.uid()), resolved_at = private.agenda_now(),
         response = v_reason
   where id = p_id;
end;
$$;

-- Erasure (RN-05 to RN-07) ----------------------------------------------------------------------------------
create function public.erase_customer_data(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.data_requests;
  v_customer public.customers;
  v_open bigint;
begin
  perform private.require_admin_for_data_requests();
  v_request := private.open_data_request(p_request_id);
  if v_request.kind <> 'erasure' then
    raise exception 'only an erasure request erases' using hint = 'data_request_wrong_kind';
  end if;
  select * into v_customer from public.customers where id = v_request.customer_id for update;

  -- RN-07: never with an open order.
  select o.number into v_open from public.work_orders o
  where o.customer_id = v_customer.id and o.status = 'open' order by o.number limit 1;
  if v_open is not null then
    raise exception 'the customer has the open order #%', v_open
      using hint = 'data_erasure_open_order', detail = v_open::text;
  end if;

  -- Their pending reservations are cancelled; notes of orders and reservations emptied.
  update public.reservations
     set status = 'cancelled', cancelled_at = private.agenda_now(), cancelled_by = (select auth.uid()),
         cancel_reason = 'Supresión de datos'
   where customer_id = v_customer.id and status = 'pending';
  update public.reservations set notes = null where customer_id = v_customer.id and notes is not null;
  update public.work_orders set notes = null where customer_id = v_customer.id and notes is not null;

  -- Their vehicles retired, without plates (vehicles_guard lets only this transaction do it).
  perform set_config('motorismo.erasing', 'on', true);
  update public.vehicles
     set plate = null, retired_at = coalesce(retired_at, now())
   where customer_id = v_customer.id;
  perform set_config('motorismo.erasing', 'off', true);

  -- The customer: no name, contact, photo nor account; disabled, so nobody serves or books them.
  update public.customers
     set full_name = 'Cliente suprimido', email = null, phone = null, avatar_url = null, user_id = null,
         disabled_at = coalesce(disabled_at, now()), erased_at = private.agenda_now()
   where id = v_customer.id;
  if v_customer.user_id is not null then
    delete from auth.users where id = v_customer.user_id;
  end if;

  -- RN-06: their requests keep no personal data; this one says it was done.
  update public.data_requests set description = null, response = null
   where customer_id = v_customer.id and id <> p_request_id;
  update public.data_requests
     set status = 'attended', resolved_by = (select auth.uid()), resolved_at = private.agenda_now(),
         description = null, response = 'Datos suprimidos'
   where id = p_request_id;
end;
$$;

-- A customer's data (CA-01, CA-03, CA-17) -------------------------------------------------------------------
create function private.customer_data_json(p_customer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'full_name', c.full_name, 'email', c.email, 'phone', c.phone, 'avatar_url', c.avatar_url,
      'origin', c.origin, 'registered_at', c.created_at, 'consent_at', c.consent_at),
    'vehicles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'vehicle_type', v.vehicle_type, 'brand', b.name, 'line', l.name, 'plate', v.plate,
               'color', v.color, 'retired_at', v.retired_at) order by v.created_at)
      from public.vehicles v
      join public.vehicle_brands b on b.id = v.brand_id
      left join public.vehicle_lines l on l.id = v.line_id
      where v.customer_id = c.id), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', o.number, 'status', o.status, 'opened_at', o.opened_at, 'closed_at', o.closed_at,
               'voided_at', o.voided_at,
               'vehicle', jsonb_build_object('brand', b.name, 'line', l.name, 'plate', v.plate),
               'services', coalesce((select jsonb_agg(jsonb_build_object('name', wl.name, 'price', wl.price)
                                                      order by wl.position)
                                     from public.work_order_lines wl where wl.work_order_id = o.id), '[]'::jsonb),
               'discount', o.discount,
               'total', coalesce((select sum(wl.price) from public.work_order_lines wl where wl.work_order_id = o.id), 0)
                        - o.discount,
               'payments', coalesce((select jsonb_agg(jsonb_build_object('method', p.method, 'amount', p.amount))
                                     from public.work_order_payments p where p.work_order_id = o.id), '[]'::jsonb)
             ) order by o.number)
      from public.work_orders o
      join public.vehicles v on v.id = o.vehicle_id
      join public.vehicle_brands b on b.id = v.brand_id
      left join public.vehicle_lines l on l.id = v.line_id
      where o.customer_id = c.id), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'number', r.number, 'status', r.status, 'slot_start', r.slot_start, 'slot_end', r.slot_end,
               'vehicle', case when v.id is null then null
                               else jsonb_build_object('brand', b.name, 'line', l.name, 'plate', v.plate) end,
               'services', coalesce((select jsonb_agg(s.name order by rs.position)
                                     from public.reservation_services rs
                                     join public.services s on s.id = rs.service_id
                                     where rs.reservation_id = r.id), '[]'::jsonb),
               'notes', r.notes, 'cancel_reason', r.cancel_reason
             ) order by r.slot_start)
      from public.reservations r
      left join public.vehicles v on v.id = r.vehicle_id
      left join public.vehicle_brands b on b.id = v.brand_id
      left join public.vehicle_lines l on l.id = v.line_id
      where r.customer_id = c.id), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'kind', r.kind, 'channel', r.channel, 'status', r.status, 'description', r.description,
               'received_at', r.received_at, 'due_on', r.due_on, 'resolved_at', r.resolved_at,
               'response', r.response) order by r.received_at)
      from public.data_requests r where r.customer_id = c.id), '[]'::jsonb)
  )
  from public.customers c
  where c.id = p_customer;
$$;

revoke all on function private.customer_data_json(uuid) from public;

create function public.my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return private.customer_data_json(private.require_active_customer());
end;
$$;

create function public.customer_data(p_customer uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_data_requests();
  return private.customer_data_json(p_customer);
end;
$$;

revoke execute on function public.request_data_change(public.data_request_kind, text),
  public.withdraw_data_request(uuid),
  public.register_data_request(uuid, public.data_request_kind, public.data_request_channel, text),
  public.resolve_data_request(uuid, text), public.reject_data_request(uuid, text),
  public.erase_customer_data(uuid), public.my_data(), public.customer_data(uuid) from public, anon;
grant execute on function public.request_data_change(public.data_request_kind, text),
  public.withdraw_data_request(uuid),
  public.register_data_request(uuid, public.data_request_kind, public.data_request_channel, text),
  public.resolve_data_request(uuid, text), public.reject_data_request(uuid, text),
  public.erase_customer_data(uuid), public.my_data(), public.customer_data(uuid) to authenticated, service_role;

-- vehicles_guard, as in spec 005, with the exception of the erasure (RN-05) --------------------------------
create or replace function public.vehicles_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- Spec 017, RN-05: erasing a customer's data retires their vehicles and removes their plates, also
  -- of the ones already retired. Only erase_customer_data turns this on, for its own transaction.
  if tg_op = 'UPDATE' and current_setting('motorismo.erasing', true) = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    -- CA-22, RN-07: a retired vehicle is final (no edits, no way back).
    if old.retired_at is not null then
      raise exception 'a retired vehicle cannot change'
        using errcode = 'check_violation', hint = 'vehicle_retired';
    end if;
    -- RN-01: the owner and the identity of a vehicle never change.
    if new.id <> old.id or new.customer_id <> old.customer_id or new.created_at <> old.created_at then
      raise exception 'vehicle identity columns are immutable'
        using errcode = 'check_violation', hint = 'vehicle_immutable_column';
    end if;
  end if;

  -- The retirement date is the database's, whatever the caller sent; a new vehicle is active.
  if tg_op = 'INSERT' then
    new.retired_at := null;
  elsif new.retired_at is not null then
    new.retired_at := now();
  end if;

  -- RN-03: uppercase, without spaces, hyphens or dots.
  new.plate := nullif(upper(regexp_replace(coalesce(new.plate, ''), '[[:space:].-]', '', 'g')), '');

  -- CA-09: nothing is kept that does not belong to the type.
  if new.vehicle_type = 'bicycle' then
    new.plate := null;
  end if;
  -- RN-11, CA-31: only a car keeps the city of its plate.
  if new.vehicle_type <> 'car' then
    new.plate_city_code := null;
  end if;
  if new.vehicle_type = 'motorcycle' then
    new.vehicle_class := null;
  else
    new.displacement_cc := null;
  end if;

  if new.vehicle_type <> 'bicycle' and new.plate is null then
    raise exception 'a % needs a plate', new.vehicle_type
      using errcode = 'check_violation', hint = 'vehicle_plate_required';
  end if;
  if (new.vehicle_type = 'motorcycle' and new.plate !~ '^[A-Z]{3}[0-9]{2}[A-Z]?$')
     or (new.vehicle_type = 'car' and new.plate !~ '^[A-Z]{3}[0-9]{3}$') then
    raise exception 'invalid plate for a %: %', new.vehicle_type, new.plate
      using errcode = 'check_violation', hint = 'vehicle_plate_invalid';
  end if;
  if (new.vehicle_type = 'car' and new.vehicle_class is distinct from 'automobile' and new.vehicle_class is distinct from 'utility')
     or (new.vehicle_type = 'bicycle' and new.vehicle_class is distinct from 'mountain' and new.vehicle_class is distinct from 'road') then
    raise exception 'a % needs a class of its type', new.vehicle_type
      using errcode = 'check_violation', hint = 'vehicle_class_required';
  end if;
  if new.vehicle_type <> 'bicycle' and new.line_id is null then
    raise exception 'a % needs a line', new.vehicle_type
      using errcode = 'check_violation', hint = 'vehicle_line_required';
  end if;
  if new.displacement_cc is not null and new.displacement_cc not between 50 and 2500 then
    raise exception 'displacement out of range: % cc', new.displacement_cc
      using errcode = 'check_violation', hint = 'vehicle_displacement_invalid';
  end if;
  -- RN-11: a car needs the city of its plate, from the municipalities list (CA-31). Checked here,
  -- with a hint, before the foreign key would refuse an unknown code.
  if new.vehicle_type = 'car' and new.plate_city_code is null then
    raise exception 'a car needs the city of its plate'
      using errcode = 'check_violation', hint = 'vehicle_plate_city_required';
  end if;
  if new.plate_city_code is not null
     and not exists (select 1 from public.municipalities m where m.code = new.plate_city_code) then
    raise exception 'unknown plate city: %', new.plate_city_code
      using errcode = 'check_violation', hint = 'vehicle_plate_city_invalid';
  end if;

  -- RN-04, RN-08: one active vehicle per plate, without telling whose it is.
  if new.retired_at is null
     and new.plate is not null
     and (tg_op = 'INSERT' or new.plate is distinct from old.plate or old.retired_at is not null)
     and private.vehicle_plate_taken(new.plate, new.id) then
    raise exception 'plate already registered'
      using errcode = 'unique_violation', hint = 'vehicle_plate_taken';
  end if;

  return new;
end;
$function$

;

-- customers_guard, as in spec 004 (20261120145300), with an erased customer final (RN-09) -------------
create or replace function public.customers_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
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

  -- Spec 017, RN-09: an erased customer is final: nobody edits, reactivates or disables them again
  -- from the app (erase_customer_data itself is not the API).
  if tg_op = 'UPDATE' and v_from_api and old.erased_at is not null then
    raise exception 'an erased customer cannot change'
      using errcode = 'check_violation', hint = 'customer_erased';
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
$function$

;
