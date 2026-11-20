-- Work orders (spec 008): what is done to a vehicle in one visit to the car wash.
--
-- An order belongs to a customer and one of their vehicles. It has service lines (from the
-- catalog, or "Otro" with a free description), each with a price, an optional estimated time and
-- the employees who did it with their share. It opens when the vehicle arrives and closes when it
-- is handed over and paid (one or more payments adding up to the total).
--
-- Every change goes through four SECURITY DEFINER functions that check, in one place, who may do
-- what in each state (RN-05): save_work_order, close_work_order, correct_work_order and
-- void_work_order. Staff read through RLS; nobody writes the tables directly and nobody deletes
-- (RN-06). The service catalog gains an optional estimated time (HU-06).
--
-- seeds: 05_work_orders.sql (local sample orders) and estimated times in 04_catalogs.sql

-- Catalog: estimated time (HU-06) ------------------------------------------------------------------
alter table public.services
  add column estimated_minutes smallint check (estimated_minutes between 5 and 1440);

comment on column public.services.estimated_minutes is
  'Optional estimated time in minutes (spec 008, CA-26, RN-11); copied to each order line.';

-- RLS on services already lets only an admin write (spec 007).
grant insert (estimated_minutes) on table public.services to authenticated;
grant update (estimated_minutes) on table public.services to authenticated;

-- Types ------------------------------------------------------------------------------------------
create type public.work_order_status as enum ('open', 'closed', 'voided');
create type public.payment_method as enum ('cash', 'transfer', 'card', 'other');

-- Tables -----------------------------------------------------------------------------------------
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  -- RF-01: «Orden #N», consecutive for the whole business (gaps are possible, not a fiscal number).
  number bigint generated always as identity unique,
  customer_id uuid not null references public.customers (id),
  vehicle_id uuid not null references public.vehicles (id),
  status public.work_order_status not null default 'open',
  -- CA-25: a fixed amount off the subtotal; at most the subtotal (checked by the functions).
  discount integer not null default 0 check (discount >= 0),
  notes text check (char_length(notes) <= 500),
  opened_at timestamptz not null default now(),
  opened_by uuid not null references public.profiles (id),
  closed_at timestamptz,
  closed_by uuid references public.profiles (id),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id),
  void_reason text,
  corrected_at timestamptz,
  corrected_by uuid references public.profiles (id),
  correction_reason text,
  constraint work_orders_closed_consistent check ((closed_at is null) = (closed_by is null)),
  constraint work_orders_closed_has_date check (status <> 'closed' or closed_at is not null),
  constraint work_orders_voided_consistent check (
    (status = 'voided') = (voided_at is not null)
    and (status <> 'voided' or (voided_by is not null and char_length(btrim(void_reason)) > 0))
  ),
  constraint work_orders_corrected_consistent check (
    corrected_at is null
    or (closed_at is not null and corrected_by is not null and char_length(btrim(correction_reason)) > 0)
  )
);

comment on table public.work_orders is
  'Work orders (spec 008). Written only through save/close/correct/void_work_order; never deleted.';

-- One open order per vehicle (spec assumption): the app offers to open that one instead.
create unique index work_orders_one_open_per_vehicle on public.work_orders (vehicle_id)
  where status = 'open';
create index work_orders_customer_idx on public.work_orders (customer_id, opened_at desc);
create index work_orders_status_idx on public.work_orders (status, opened_at);

create table public.work_order_lines (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id),
  position smallint not null,
  -- Null for «Otro» (CA-05).
  service_id uuid references public.services (id),
  -- RN-01: the service name as it was, or the description of «Otro».
  name text not null check (name = btrim(name) and char_length(name) between 1 and 120),
  -- RN-02: whole pesos; $ 0 is a courtesy.
  price integer not null check (price between 0 and 10000000),
  -- RN-11: optional; copied from the service and editable in the order (CA-27, CA-28).
  estimated_minutes smallint check (estimated_minutes between 5 and 1440)
);

create index work_order_lines_order_idx on public.work_order_lines (work_order_id, position);

create table public.work_order_line_employees (
  line_id uuid not null references public.work_order_lines (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  -- RN-03: whole percentages adding up to 100 per line (checked by the functions).
  share_pct smallint not null check (share_pct between 1 and 100),
  primary key (line_id, employee_id)
);

create index work_order_line_employees_employee_idx on public.work_order_line_employees (employee_id);

create table public.work_order_payments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders (id),
  method public.payment_method not null,
  amount integer not null check (amount between 1 and 100000000)
);

create index work_order_payments_order_idx on public.work_order_payments (work_order_id);

-- Staff names ------------------------------------------------------------------------------------
-- CA-20: the order shows who opened, closed, voided or corrected it. Profiles are readable only by
-- their owner and admins (spec 002), so this SECURITY DEFINER function gives staff the NAME only.
create function private.staff_name(p_profile_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name from public.profiles p
   where p.id = p_profile_id and (select public.is_staff());
$$;

revoke all on function private.staff_name(uuid) from public;
grant execute on function private.staff_name(uuid) to authenticated, service_role;

-- Summary view -----------------------------------------------------------------------------------
-- SECURITY INVOKER: it shows only what the reader's RLS lets them see (staff).
create view public.work_order_summaries
with (security_invoker = true)
as
select
  o.id,
  o.number,
  o.status,
  o.customer_id,
  c.full_name as customer_name,
  o.vehicle_id,
  v.vehicle_type,
  v.plate,
  b.name as brand_name,
  l.name as line_name,
  o.notes,
  o.opened_at,
  private.staff_name(o.opened_by) as opened_by_name,
  o.closed_at,
  private.staff_name(o.closed_by) as closed_by_name,
  o.voided_at,
  private.staff_name(o.voided_by) as voided_by_name,
  o.void_reason,
  o.corrected_at,
  private.staff_name(o.corrected_by) as corrected_by_name,
  o.correction_reason,
  coalesce(t.subtotal, 0) as subtotal,
  o.discount,
  coalesce(t.subtotal, 0) - o.discount as total,
  -- CA-29, CA-30: the estimated lines add up; the others are named.
  coalesce(t.estimated_minutes, 0) as estimated_minutes,
  coalesce(t.unestimated, '{}') as unestimated,
  coalesce(t.services, '{}') as services
from public.work_orders o
join public.customers c on c.id = o.customer_id
join public.vehicles v on v.id = o.vehicle_id
join public.vehicle_brands b on b.id = v.brand_id
left join public.vehicle_lines l on l.id = v.line_id
left join lateral (
  select
    sum(wl.price) as subtotal,
    sum(wl.estimated_minutes) as estimated_minutes,
    array_agg(wl.name order by wl.position) filter (where wl.estimated_minutes is null) as unestimated,
    array_agg(wl.name order by wl.position) as services
  from public.work_order_lines wl
  where wl.work_order_id = o.id
) t on true;

-- RLS and privileges -----------------------------------------------------------------------------
alter table public.work_orders enable row level security;
alter table public.work_order_lines enable row level security;
alter table public.work_order_line_employees enable row level security;
alter table public.work_order_payments enable row level security;

create policy work_orders_select_staff
  on public.work_orders for select to authenticated using ((select public.is_staff()));
create policy work_order_lines_select_staff
  on public.work_order_lines for select to authenticated using ((select public.is_staff()));
create policy work_order_line_employees_select_staff
  on public.work_order_line_employees for select to authenticated using ((select public.is_staff()));
create policy work_order_payments_select_staff
  on public.work_order_payments for select to authenticated using ((select public.is_staff()));

-- CA-14, CA-24: no direct writes and no deletes, for anyone; only the functions below write.
revoke all on table public.work_orders, public.work_order_lines, public.work_order_line_employees,
  public.work_order_payments, public.work_order_summaries from anon, authenticated;
grant select on table public.work_orders, public.work_order_lines, public.work_order_line_employees,
  public.work_order_payments, public.work_order_summaries to authenticated;

-- Shared rules -----------------------------------------------------------------------------------
-- Errors carry a hint the app maps to a message.
create function private.work_order_fail(p_errcode text, p_hint text, p_message text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using message = p_message, errcode = p_errcode, hint = p_hint;
end;
$$;

-- Writes the lines of an order as sent: a line with "id" is kept and updated, a new one is added,
-- and the ones not sent are removed (CA-08). A new catalog line needs an active service with a
-- price for the vehicle type and copies its name, price and time (CA-03, CA-27, RN-01); «Otro»
-- needs a description (CA-05). Employees new to a line must be active, and shares add up to 100
-- (CA-06, RN-03, RN-04).
create function private.work_order_write_lines(
  p_order_id uuid, p_vehicle_type public.vehicle_type, p_lines jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_elem jsonb;
  v_position int;
  v_line_id uuid;
  v_keep uuid[] := '{}';
  v_existing public.work_order_lines;
  v_service public.services;
  v_name text;
  v_price int;
  v_minutes int;
  v_previous uuid[];
  v_share jsonb;
  v_sum int;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform private.work_order_fail('23514', 'work_order_lines_required', 'an order needs at least one service');
  end if;

  for v_elem, v_position in select e, i from jsonb_array_elements(p_lines) with ordinality as x(e, i) loop
    v_line_id := nullif(v_elem ->> 'id', '')::uuid;

    if v_line_id is not null then
      select * into v_existing from public.work_order_lines
       where id = v_line_id and work_order_id = p_order_id;
      if not found then
        perform private.work_order_fail('P0002', 'work_order_line_not_found', 'line not found in this order');
      end if;
      v_name := case when v_existing.service_id is null then btrim(coalesce(v_elem ->> 'name', v_existing.name))
                     else v_existing.name end;
      v_price := coalesce((v_elem ->> 'price')::int, v_existing.price);
      v_minutes := case when v_elem ? 'estimated_minutes' then (v_elem ->> 'estimated_minutes')::int
                        else v_existing.estimated_minutes end;
      if v_existing.service_id is null and coalesce(v_name, '') = '' then
        perform private.work_order_fail('23514', 'work_order_other_name_required', '«Otro» needs a description');
      end if;
      update public.work_order_lines
         set position = v_position, name = v_name, price = v_price, estimated_minutes = v_minutes
       where id = v_line_id;
    else
      if nullif(v_elem ->> 'service_id', '') is not null then
        select * into v_service from public.services
         where id = (v_elem ->> 'service_id')::uuid and disabled_at is null;
        v_price := case p_vehicle_type
          when 'motorcycle' then v_service.price_motorcycle
          when 'car' then v_service.price_car
          else v_service.price_bicycle end;
        if v_service.id is null or v_price is null then
          perform private.work_order_fail('23514', 'work_order_service_unavailable',
            'the service is not offered for this vehicle');
        end if;
        v_name := v_service.name;
        v_price := coalesce((v_elem ->> 'price')::int, v_price);
        v_minutes := case when v_elem ? 'estimated_minutes' then (v_elem ->> 'estimated_minutes')::int
                          else v_service.estimated_minutes end;
      else
        v_service := null;
        v_name := btrim(coalesce(v_elem ->> 'name', ''));
        if v_name = '' then
          perform private.work_order_fail('23514', 'work_order_other_name_required', '«Otro» needs a description');
        end if;
        v_price := (v_elem ->> 'price')::int;
        if v_price is null then
          perform private.work_order_fail('23514', 'work_order_price_required', 'a line needs a price');
        end if;
        v_minutes := (v_elem ->> 'estimated_minutes')::int;
      end if;
      insert into public.work_order_lines (work_order_id, position, service_id, name, price, estimated_minutes)
      values (p_order_id, v_position, v_service.id, v_name, v_price, v_minutes)
      returning id into v_line_id;
    end if;
    v_keep := v_keep || v_line_id;

    -- Employees: replaced only when sent.
    if v_elem ? 'employees' then
      select coalesce(array_agg(employee_id), '{}') into v_previous
        from public.work_order_line_employees where line_id = v_line_id;
      delete from public.work_order_line_employees where line_id = v_line_id;
      v_sum := 0;
      for v_share in select * from jsonb_array_elements(coalesce(v_elem -> 'employees', '[]'::jsonb)) loop
        if not ((v_share ->> 'employee_id')::uuid = any (v_previous))
           and not exists (select 1 from public.employees
                            where id = (v_share ->> 'employee_id')::uuid and disabled_at is null) then
          perform private.work_order_fail('23514', 'work_order_employee_unavailable',
            'the employee is not active');
        end if;
        insert into public.work_order_line_employees (line_id, employee_id, share_pct)
        values (v_line_id, (v_share ->> 'employee_id')::uuid, (v_share ->> 'share_pct')::int);
        v_sum := v_sum + (v_share ->> 'share_pct')::int;
      end loop;
      if v_sum <> 0 and v_sum <> 100 then
        perform private.work_order_fail('23514', 'work_order_shares_invalid', 'shares must add up to 100');
      end if;
    end if;
  end loop;

  delete from public.work_order_lines where work_order_id = p_order_id and not (id = any (v_keep));
end;
$$;

-- CA-25: the discount goes from 0 to the subtotal.
create function private.work_order_set_discount(p_order_id uuid, p_discount integer)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_subtotal bigint;
begin
  select coalesce(sum(price), 0) into v_subtotal from public.work_order_lines where work_order_id = p_order_id;
  if p_discount < 0 or p_discount > v_subtotal then
    perform private.work_order_fail('23514', 'work_order_discount_invalid', 'the discount must be 0 to the subtotal');
  end if;
  update public.work_orders set discount = p_discount where id = p_order_id;
end;
$$;

-- CA-11 to CA-13: every line has employees, and the payments add up to the total.
create function private.work_order_write_payments(p_order_id uuid, p_payments jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_total bigint;
  v_paid bigint;
begin
  if exists (
    select 1 from public.work_order_lines wl
     where wl.work_order_id = p_order_id
       and not exists (select 1 from public.work_order_line_employees e where e.line_id = wl.id)
  ) then
    perform private.work_order_fail('23514', 'work_order_line_without_employees', 'every line needs employees');
  end if;

  delete from public.work_order_payments where work_order_id = p_order_id;
  insert into public.work_order_payments (work_order_id, method, amount)
  select p_order_id, (p ->> 'method')::public.payment_method, (p ->> 'amount')::int
    from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) as x(p);

  select total into v_total from public.work_order_summaries where id = p_order_id;
  select coalesce(sum(amount), 0) into v_paid from public.work_order_payments where work_order_id = p_order_id;
  if v_paid <> v_total then
    perform private.work_order_fail('23514', 'work_order_payments_mismatch', 'payments must add up to the total');
  end if;
end;
$$;

revoke all on function private.work_order_fail(text, text, text) from public;
revoke all on function private.work_order_write_lines(uuid, public.vehicle_type, jsonb) from public;
revoke all on function private.work_order_set_discount(uuid, integer) from public;
revoke all on function private.work_order_write_payments(uuid, jsonb) from public;

-- save_work_order --------------------------------------------------------------------------------
-- Opens an order (no p_id, CA-07) or edits an open one (CA-08). Staff only. Without p_discount an
-- edit keeps the current one.
create function public.save_work_order(
  p_customer_id uuid,
  p_vehicle_id uuid,
  p_lines jsonb,
  p_discount integer default null,
  p_notes text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.work_orders;
  v_vehicle public.vehicles;
  v_customer public.customers;
  v_busy bigint;
begin
  if not (select public.is_staff()) then
    perform private.work_order_fail('42501', 'work_order_staff_only', 'only staff manage work orders');
  end if;

  if p_id is null then
    select * into v_customer from public.customers where id = p_customer_id;
    if not found then
      perform private.work_order_fail('P0002', 'work_order_customer_not_found', 'customer not found');
    end if;
    if v_customer.disabled_at is not null then
      perform private.work_order_fail('23514', 'work_order_customer_disabled', 'the customer is disabled');
    end if;
    select * into v_vehicle from public.vehicles where id = p_vehicle_id;
    if not found or v_vehicle.customer_id <> p_customer_id then
      perform private.work_order_fail('23514', 'work_order_vehicle_invalid', 'the vehicle is not the customer''s');
    end if;
    if v_vehicle.retired_at is not null then
      perform private.work_order_fail('23514', 'work_order_vehicle_retired', 'the vehicle is retired');
    end if;
    select number into v_busy from public.work_orders where vehicle_id = p_vehicle_id and status = 'open';
    if v_busy is not null then
      perform private.work_order_fail('23505', 'work_order_vehicle_busy',
        format('the vehicle already has the open order #%s', v_busy));
    end if;
    insert into public.work_orders (customer_id, vehicle_id, notes, opened_by)
    values (p_customer_id, p_vehicle_id, nullif(btrim(p_notes), ''), (select auth.uid()))
    returning * into v_order;
  else
    select * into v_order from public.work_orders where id = p_id for update;
    if not found then
      perform private.work_order_fail('P0002', 'work_order_not_found', 'work order not found');
    end if;
    if v_order.status <> 'open' then
      perform private.work_order_fail('23514', 'work_order_not_open', 'only an open order can be edited');
    end if;
    select * into v_vehicle from public.vehicles where id = v_order.vehicle_id;
    update public.work_orders set notes = nullif(btrim(p_notes), '') where id = v_order.id;
  end if;

  perform private.work_order_write_lines(v_order.id, v_vehicle.vehicle_type, p_lines);
  perform private.work_order_set_discount(v_order.id, coalesce(p_discount, v_order.discount));
  return v_order.id;
end;
$$;

-- close_work_order -------------------------------------------------------------------------------
-- Staff close an open order with its payments (CA-11 to CA-13).
create function public.close_work_order(p_id uuid, p_payments jsonb default '[]')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.work_orders;
begin
  if not (select public.is_staff()) then
    perform private.work_order_fail('42501', 'work_order_staff_only', 'only staff manage work orders');
  end if;
  select * into v_order from public.work_orders where id = p_id for update;
  if not found then
    perform private.work_order_fail('P0002', 'work_order_not_found', 'work order not found');
  end if;
  if v_order.status <> 'open' then
    perform private.work_order_fail('23514', 'work_order_not_open', 'only an open order can be closed');
  end if;

  perform private.work_order_write_payments(p_id, p_payments);
  update public.work_orders set status = 'closed', closed_at = now(), closed_by = (select auth.uid())
   where id = p_id;
end;
$$;

-- correct_work_order -----------------------------------------------------------------------------
-- An admin corrects a closed order with a reason (CA-22): the same rules as saving and closing.
create function public.correct_work_order(
  p_id uuid,
  p_lines jsonb,
  p_payments jsonb,
  p_reason text,
  p_discount integer default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.work_orders;
  v_vehicle public.vehicles;
begin
  if not (select public.is_admin()) then
    perform private.work_order_fail('42501', 'work_order_admin_only', 'only an admin corrects a closed order');
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    perform private.work_order_fail('23514', 'work_order_reason_required', 'a reason is required');
  end if;
  select * into v_order from public.work_orders where id = p_id for update;
  if not found then
    perform private.work_order_fail('P0002', 'work_order_not_found', 'work order not found');
  end if;
  if v_order.status <> 'closed' then
    perform private.work_order_fail('23514', 'work_order_not_closed', 'only a closed order is corrected');
  end if;
  select * into v_vehicle from public.vehicles where id = v_order.vehicle_id;

  update public.work_orders set notes = nullif(btrim(p_notes), '') where id = p_id;
  perform private.work_order_write_lines(p_id, v_vehicle.vehicle_type, p_lines);
  perform private.work_order_set_discount(p_id, coalesce(p_discount, v_order.discount));
  perform private.work_order_write_payments(p_id, p_payments);
  update public.work_orders
     set corrected_at = now(), corrected_by = (select auth.uid()), correction_reason = btrim(p_reason)
   where id = p_id;
end;
$$;

-- void_work_order --------------------------------------------------------------------------------
-- Staff void an open order; only an admin a closed one; always with a reason (CA-21, CA-23).
create function public.void_work_order(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.work_orders;
begin
  if not (select public.is_staff()) then
    perform private.work_order_fail('42501', 'work_order_staff_only', 'only staff manage work orders');
  end if;
  select * into v_order from public.work_orders where id = p_id for update;
  if not found then
    perform private.work_order_fail('P0002', 'work_order_not_found', 'work order not found');
  end if;
  if v_order.status = 'voided' then
    perform private.work_order_fail('23514', 'work_order_already_voided', 'the order is already voided');
  end if;
  if v_order.status = 'closed' and not (select public.is_admin()) then
    perform private.work_order_fail('42501', 'work_order_admin_only', 'only an admin voids a closed order');
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    perform private.work_order_fail('23514', 'work_order_reason_required', 'a reason is required');
  end if;

  update public.work_orders
     set status = 'voided', voided_at = now(), voided_by = (select auth.uid()), void_reason = btrim(p_reason)
   where id = p_id;
end;
$$;

revoke execute on function public.save_work_order(uuid, uuid, jsonb, integer, text, uuid) from public, anon;
revoke execute on function public.close_work_order(uuid, jsonb) from public, anon;
revoke execute on function public.correct_work_order(uuid, jsonb, jsonb, text, integer, text) from public, anon;
revoke execute on function public.void_work_order(uuid, text) from public, anon;
grant execute on function public.save_work_order(uuid, uuid, jsonb, integer, text, uuid) to authenticated, service_role;
grant execute on function public.close_work_order(uuid, jsonb) to authenticated, service_role;
grant execute on function public.correct_work_order(uuid, jsonb, jsonb, text, integer, text) to authenticated, service_role;
grant execute on function public.void_work_order(uuid, text) to authenticated, service_role;
