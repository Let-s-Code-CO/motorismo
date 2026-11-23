-- Spec 015 — the services done in closed orders, for the admin.
--
-- * private.report_lines: the filtered set — one row per line of a closed order (never an open or
--   voided one), by the closing day in Colombia, both ends included; optionally the lines an
--   employee took part in, and the orders of a vehicle by its whole plate, normalized (RN-01,
--   CA-02 to CA-05, CA-07).
-- * service_report: its rows, newest first; a page with p_limit, or all without it (the Excel) (CA-01,
--   CA-11, CA-12).
-- * service_report_totals: how many and their sum; the discounts of those orders and the total only
--   without an employee filter, since a discount belongs to the whole order (CA-06, RN-03).
-- * Admin only, in the database (RN-04): both refuse anyone else.
--
-- seeds: unchanged — the closed orders of seeds/05_work_orders.sql are enough.

create index if not exists work_orders_closed_idx on public.work_orders (status, closed_at);

-- The filtered set --------------------------------------------------------------------------------
create function private.report_lines(p_from date, p_to date, p_employee uuid, p_plate text)
returns table (line_id uuid, order_id uuid, line_position smallint, closed_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select wl.id, o.id, wl.position, o.closed_at
  from public.work_orders o
  join public.work_order_lines wl on wl.work_order_id = o.id
  join public.vehicles v on v.id = o.vehicle_id
  where o.status = 'closed'
    and (o.closed_at at time zone 'America/Bogota')::date between p_from and p_to
    and (p_employee is null or exists (
      select 1 from public.work_order_line_employees le
      where le.line_id = wl.id and le.employee_id = p_employee))
    and (nullif(btrim(p_plate), '') is null
         or v.plate = upper(regexp_replace(p_plate, '[^A-Za-z0-9]', '', 'g')));
$$;

revoke all on function private.report_lines(date, date, uuid, text) from public;
grant execute on function private.report_lines(date, date, uuid, text) to authenticated, service_role;

create function private.require_admin_for_report()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'only an admin sees the reports' using errcode = '42501', hint = 'report_admin_only';
  end if;
end;
$$;

revoke all on function private.require_admin_for_report() from public;
grant execute on function private.require_admin_for_report() to authenticated, service_role;

-- service_report ------------------------------------------------------------------------------------
create function public.service_report(
  p_from date,
  p_to date,
  p_employee uuid default null,
  p_plate text default null,
  p_limit integer default null,
  p_offset integer default 0
)
returns table (
  line_id uuid, order_id uuid, order_number bigint, closed_at timestamptz, customer_name text,
  vehicle_type text, brand_name text, line_name text, plate text, service_name text, price integer,
  employees jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_report();
  return query
    select wl.id, o.id, o.number, o.closed_at, c.full_name, v.vehicle_type::text, b.name, l.name,
           v.plate, wl.name, wl.price,
           coalesce((
             select jsonb_agg(jsonb_build_object('name', e.full_name, 'share', le.share_pct)
                              order by le.share_pct desc, e.full_name)
             from public.work_order_line_employees le
             join public.employees e on e.id = le.employee_id
             where le.line_id = wl.id), '[]'::jsonb)
    from private.report_lines(p_from, p_to, p_employee, p_plate) rl
    join public.work_order_lines wl on wl.id = rl.line_id
    join public.work_orders o on o.id = rl.order_id
    join public.customers c on c.id = o.customer_id
    join public.vehicles v on v.id = o.vehicle_id
    join public.vehicle_brands b on b.id = v.brand_id
    left join public.vehicle_lines l on l.id = v.line_id
    order by o.closed_at desc, o.number desc, wl.position
    limit p_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- service_report_totals ---------------------------------------------------------------------------
create function public.service_report_totals(
  p_from date,
  p_to date,
  p_employee uuid default null,
  p_plate text default null
)
returns table (services integer, subtotal integer, discounts integer, total integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_services integer;
  v_subtotal integer;
  v_discounts integer;
begin
  perform private.require_admin_for_report();
  select count(*)::integer, coalesce(sum(wl.price), 0)::integer
    into v_services, v_subtotal
  from private.report_lines(p_from, p_to, p_employee, p_plate) rl
  join public.work_order_lines wl on wl.id = rl.line_id;

  if p_employee is not null then
    -- RN-03: a discount belongs to the whole order, not to an employee's services.
    return query select v_services, v_subtotal, null::integer, null::integer;
    return;
  end if;

  select coalesce(sum(o.discount), 0)::integer into v_discounts
  from public.work_orders o
  where o.id in (select rl.order_id from private.report_lines(p_from, p_to, null, p_plate) rl);
  return query select v_services, v_subtotal, v_discounts, v_subtotal - v_discounts;
end;
$$;

revoke execute on function public.service_report(date, date, uuid, text, integer, integer) from public, anon;
revoke execute on function public.service_report_totals(date, date, uuid, text) from public, anon;
grant execute on function public.service_report(date, date, uuid, text, integer, integer) to authenticated, service_role;
grant execute on function public.service_report_totals(date, date, uuid, text) to authenticated, service_role;
