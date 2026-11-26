-- Payroll by fortnight and between any two dates (spec 020), instead of by month (spec 016).
--
-- * A period is two dates, both included: a fortnight (1st to 15th, 16th to the last day) or any range
--   (RF-01). Commissions as in spec 016 (RN-01); the base salary is cut by fortnight and each piece
--   paid by the method the admin chooses (RN-02): «commercial» (15 days of 30 for a whole fortnight,
--   otherwise salary ÷ 30 per active day, at most 15) or «actual» (salary × active days ÷ days of the
--   month).
-- * Only a fortnight that has ended is closed, with its method (RF-02, RN-04, CA-16); a range is a
--   query. A range exactly a fortnight is that fortnight (CA-08).
-- * No closed month is real yet (the app has not been deployed: spec 020, «Suposiciones»), so the
--   closed payrolls are dropped and created again by fortnight; nothing is converted.
--
-- seeds: unchanged — no seed closes a payroll.

-- Out: the payroll by month ---------------------------------------------------------------------------------
drop function public.payroll_month(date);
drop function public.payroll_lines(date);
drop function public.payroll_items(date, uuid);
drop function public.close_payroll(date);
drop function public.regenerate_payroll(date);
drop function private.payroll_write(uuid, date);
drop function private.payroll_changed(uuid, date);
drop function private.payroll_lines_live(date);
drop function private.payroll_items_live(date);
drop function private.active_days(uuid, date);
drop table public.payroll_items, public.payroll_lines, public.payrolls;

-- Fortnights ------------------------------------------------------------------------------------------------
-- The first day of the fortnight a day is in: the 1st or the 16th.
create function private.fortnight_start(p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('month', p_day::timestamp)::date + case when extract(day from p_day) <= 15 then 0 else 15 end;
$$;

-- The last day of the fortnight a day is in: the 15th or the last day of its month.
create function private.fortnight_end(p_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when extract(day from p_day) <= 15 then date_trunc('month', p_day::timestamp)::date + 14
    else (date_trunc('month', p_day::timestamp) + interval '1 month' - interval '1 day')::date
  end;
$$;

-- Closed payrolls (HU-03): a fortnight each ---------------------------------------------------------------------
create table public.payrolls (
  id uuid primary key default gen_random_uuid(),
  -- the 1st or the 16th
  period_start date not null unique check (period_start = private.fortnight_start(period_start)),
  -- the 15th or the last day of the month
  period_end date not null,
  -- how its base salary was computed (CA-16)
  base_method text not null check (base_method in ('commercial', 'actual')),
  total integer not null default 0,
  closed_by uuid not null references public.profiles (id),
  closed_at timestamptz not null,
  regenerated_by uuid references public.profiles (id),
  regenerated_at timestamptz,
  -- the total before the last regeneration
  previous_total integer,
  constraint payrolls_period_end_check check (period_end = private.fortnight_end(period_start))
);

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payrolls (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  employee_name text not null,
  active_days smallint not null,
  -- days of the fortnight (13 to 16)
  period_days smallint not null,
  -- the days its base salary paid, and what they were divided by (CA-04): commercial, 15 or the
  -- active days (at most 15) ÷ 30; actual, the active days ÷ the days of the month
  paid_days smallint not null,
  divisor smallint not null,
  base_salary integer not null,
  base_pay integer not null,
  commission_pct smallint not null,
  commissions integer not null,
  total integer not null,
  unique (payroll_id, employee_id)
);

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  payroll_line_id uuid not null references public.payroll_lines (id) on delete cascade,
  line_id uuid not null,
  order_id uuid not null,
  order_number bigint not null,
  closed_at timestamptz not null,
  line_position smallint not null,
  service_name text not null,
  price integer not null,
  share_pct smallint not null,
  commission numeric(14, 4) not null
);
create index payroll_items_line_idx on public.payroll_items (payroll_line_id);

comment on table public.payrolls is
  'A closed fortnight of payroll (spec 020, HU-03): a fixed copy, written only by close/regenerate_payroll.';

alter table public.payrolls enable row level security;
alter table public.payroll_lines enable row level security;
alter table public.payroll_items enable row level security;
create policy payrolls_select_admin on public.payrolls for select to authenticated
  using ((select public.is_admin()));
create policy payroll_lines_select_admin on public.payroll_lines for select to authenticated
  using ((select public.is_admin()));
create policy payroll_items_select_admin on public.payroll_items for select to authenticated
  using ((select public.is_admin()));
revoke all on table public.payrolls, public.payroll_lines, public.payroll_items from anon, authenticated;
grant select on table public.payrolls, public.payroll_lines, public.payroll_items to authenticated;

-- The computation ---------------------------------------------------------------------------------------------
-- The method and the period asked for, or a refusal.
create function private.payroll_check(p_from date, p_to date, p_method text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_method is null or p_method not in ('commercial', 'actual') then
    raise exception 'unknown base salary method: %', p_method
      using errcode = 'invalid_parameter_value', hint = 'payroll_method_invalid';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'the period ends before it starts' using errcode = 'invalid_parameter_value',
      hint = 'payroll_period_invalid';
  end if;
end;
$$;

-- Whether two dates are exactly a fortnight (CA-08).
create function private.is_fortnight(p_from date, p_to date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_from = private.fortnight_start(p_from) and p_to = private.fortnight_end(p_from);
$$;

-- How many days between two dates the employee was active at some moment, in Colombia (RN-03).
create function private.payroll_active_days(p_employee uuid, p_from date, p_to date)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_from, p_to, interval '1 day') d(day)
  where exists (
    select 1 from public.employee_active_periods p
    where p.employee_id = p_employee
      and (p.started_at at time zone 'America/Bogota')::date <= d.day::date
      and (p.ended_at is null or (p.ended_at at time zone 'America/Bogota')::date >= d.day::date));
$$;

-- The base salary of each employee in a period, a piece per fortnight it touches (RN-02).
create function private.payroll_base_parts_live(p_from date, p_to date, p_method text)
returns table (
  employee_id uuid, part_from date, part_to date, part_days integer, active_days integer,
  paid_days integer, divisor integer, amount numeric
)
language sql
stable
set search_path = ''
as $$
  with starts as (
    select distinct private.fortnight_start(d::date) as f_start
    from generate_series(p_from, p_to, interval '1 day') d
  ),
  parts as (
    select greatest(s.f_start, p_from) as part_from, least(private.fortnight_end(s.f_start), p_to) as part_to,
           s.f_start, private.fortnight_end(s.f_start) as f_end
    from starts s
  ),
  counted as (
    select e.id as employee_id, pt.part_from, pt.part_to, (pt.part_to - pt.part_from + 1) as part_days,
           private.payroll_active_days(e.id, pt.part_from, pt.part_to) as active_days,
           pt.part_from = pt.f_start and pt.part_to = pt.f_end as whole,
           extract(day from date_trunc('month', pt.part_from::timestamp) + interval '1 month' - interval '1 day')::integer
             as month_days,
           coalesce(d.base_salary, 0) as base
    from public.employees e
    left join public.employee_details d on d.employee_id = e.id
    cross join parts pt
  ),
  paid as (
    select c.*,
           case
             when p_method = 'actual' then c.active_days
             when c.whole and c.active_days = c.part_days then 15
             else least(c.active_days, 15)
           end as paid_days,
           case when p_method = 'actual' then c.month_days else 30 end as divisor
    from counted c
  )
  select p.employee_id, p.part_from, p.part_to, p.part_days, p.active_days, p.paid_days, p.divisor,
         p.base::numeric * p.paid_days / p.divisor
  from paid p
  order by p.employee_id, p.part_from;
$$;

-- Each service of the orders closed in the period and each employee in it, with their commission:
-- value × share × commission %, the order's discount ignored (spec 016, RN-01 to RN-03).
create function private.payroll_items_live(p_from date, p_to date)
returns table (
  employee_id uuid, line_id uuid, order_id uuid, order_number bigint, closed_at timestamptz,
  line_position smallint, service_name text, price integer, share_pct smallint, commission_pct smallint,
  commission numeric
)
language sql
stable
set search_path = ''
as $$
  select le.employee_id, wl.id, o.id, o.number, o.closed_at, wl.position, wl.name, wl.price,
         le.share_pct::smallint, coalesce(d.commission_pct, 0)::smallint,
         round(wl.price::numeric * le.share_pct * coalesce(d.commission_pct, 0) / 10000, 4)
  from public.work_orders o
  join public.work_order_lines wl on wl.work_order_id = o.id
  join public.work_order_line_employees le on le.line_id = wl.id
  left join public.employee_details d on d.employee_id = le.employee_id
  where o.status = 'closed'
    and (o.closed_at at time zone 'America/Bogota')::date between p_from and p_to;
$$;

-- Each employee of the period: active some day or with commissions in it (CA-04); the base salary of
-- the pieces and the commissions, each rounded once (spec 016, RN-05).
create function private.payroll_lines_live(p_from date, p_to date, p_method text)
returns table (
  employee_id uuid, employee_name text, active_days integer, period_days integer, base_salary integer,
  base_pay integer, commission_pct integer, commissions integer, total integer
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select b.employee_id, sum(b.active_days)::integer as active_days, sum(b.amount) as amount
    from private.payroll_base_parts_live(p_from, p_to, p_method) b
    group by b.employee_id
  ),
  sums as (
    select i.employee_id, sum(i.commission) as commission
    from private.payroll_items_live(p_from, p_to) i
    group by i.employee_id
  ),
  computed as (
    select e.id, e.full_name, b.active_days, coalesce(d.base_salary, 0) as base,
           round(b.amount)::integer as base_pay, coalesce(d.commission_pct, 0)::integer as pct,
           coalesce(round(s.commission), 0)::integer as commissions
    from public.employees e
    left join public.employee_details d on d.employee_id = e.id
    join base b on b.employee_id = e.id
    left join sums s on s.employee_id = e.id
    where b.active_days > 0 or s.commission is not null
  )
  select c.id, c.full_name, c.active_days, (p_to - p_from + 1)::integer, c.base, c.base_pay, c.pct,
         c.commissions, c.base_pay + c.commissions
  from computed c
  order by c.full_name, c.id;
$$;

-- Writes the fixed copy of a fortnight into its payroll (lines, how each base salary was reached, the
-- detail and the total), with the payroll's method.
create function private.payroll_write(p_payroll uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v public.payrolls;
begin
  select * into v from public.payrolls p where p.id = p_payroll;
  insert into public.payroll_lines (payroll_id, employee_id, employee_name, active_days, period_days, paid_days,
                                    divisor, base_salary, base_pay, commission_pct, commissions, total)
  select p_payroll, l.employee_id, l.employee_name, l.active_days, l.period_days, b.paid_days, b.divisor,
         l.base_salary, l.base_pay, l.commission_pct, l.commissions, l.total
  from private.payroll_lines_live(v.period_start, v.period_end, v.base_method) l
  -- a fortnight is a single piece
  join private.payroll_base_parts_live(v.period_start, v.period_end, v.base_method) b
    on b.employee_id = l.employee_id;

  insert into public.payroll_items (payroll_line_id, line_id, order_id, order_number, closed_at,
                                    line_position, service_name, price, share_pct, commission)
  select pl.id, i.line_id, i.order_id, i.order_number, i.closed_at, i.line_position, i.service_name,
         i.price, i.share_pct, i.commission
  from private.payroll_items_live(v.period_start, v.period_end) i
  join public.payroll_lines pl on pl.payroll_id = p_payroll and pl.employee_id = i.employee_id;

  update public.payrolls
     set total = (select coalesce(sum(l.total), 0) from public.payroll_lines l where l.payroll_id = p_payroll)
   where id = p_payroll;
end;
$$;

-- CA-12: whether regenerating with the method it was closed with would give another result.
create function private.payroll_changed(p_payroll uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  with v as (select * from public.payrolls where id = p_payroll),
  live_lines as (
    select l.employee_id, l.active_days, l.period_days, l.base_salary, l.base_pay, l.commission_pct, l.commissions,
           l.total
    from v, private.payroll_lines_live(v.period_start, v.period_end, v.base_method) l
  ),
  kept_lines as (
    select employee_id, active_days::integer, period_days::integer, base_salary, base_pay,
           commission_pct::integer, commissions, total
    from public.payroll_lines where payroll_id = p_payroll
  ),
  live_items as (
    select i.employee_id, i.line_id, i.price, i.share_pct, i.commission
    from v, private.payroll_items_live(v.period_start, v.period_end) i
  ),
  kept_items as (
    select pl.employee_id, pi.line_id, pi.price, pi.share_pct, pi.commission
    from public.payroll_items pi
    join public.payroll_lines pl on pl.id = pi.payroll_line_id
    where pl.payroll_id = p_payroll
  )
  select exists (select * from live_lines except select * from kept_lines)
      or exists (select * from kept_lines except select * from live_lines)
      or exists (select * from live_items except select * from kept_items)
      or exists (select * from kept_items except select * from live_items);
$$;

revoke all on function private.fortnight_start(date), private.fortnight_end(date),
  private.payroll_check(date, date, text), private.is_fortnight(date, date),
  private.payroll_active_days(uuid, date, date), private.payroll_base_parts_live(date, date, text),
  private.payroll_items_live(date, date), private.payroll_lines_live(date, date, text),
  private.payroll_write(uuid), private.payroll_changed(uuid) from public;

-- Reading a period (HU-01, HU-02) -------------------------------------------------------------------------------
-- Its kind (a fortnight or a range), its state (provisional, closed or a query), the method of its
-- figures (the one it was closed with, or the one asked for), its total, who closed or regenerated it
-- and when, the total before regenerating, whether something changed since, and whether it may be
-- closed: a fortnight that has ended, not closed yet (RN-04).
create function public.payroll_period(p_from date, p_to date, p_method text)
returns table (
  kind text, status text, method text, total integer, closed_at timestamptz, closed_by_name text,
  regenerated_at timestamptz, regenerated_by_name text, previous_total integer,
  changed_since_close boolean, can_close boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payroll public.payrolls;
  v_total integer;
begin
  perform private.require_admin_for_payroll();
  perform private.payroll_check(p_from, p_to, p_method);
  select coalesce(sum(l.total), 0)::integer into v_total from private.payroll_lines_live(p_from, p_to, p_method) l;
  if not private.is_fortnight(p_from, p_to) then
    return query select 'range'::text, 'query'::text, p_method, v_total, null::timestamptz, null::text,
                        null::timestamptz, null::text, null::integer, false, false;
    return;
  end if;
  select * into v_payroll from public.payrolls p where p.period_start = p_from;
  if found then
    return query
      select 'fortnight'::text, 'closed'::text, v_payroll.base_method, v_payroll.total, v_payroll.closed_at,
             (select pr.full_name from public.profiles pr where pr.id = v_payroll.closed_by),
             v_payroll.regenerated_at,
             (select pr.full_name from public.profiles pr where pr.id = v_payroll.regenerated_by),
             v_payroll.previous_total, private.payroll_changed(v_payroll.id), false;
    return;
  end if;
  return query
    select 'fortnight'::text, 'provisional'::text, p_method, v_total, null::timestamptz, null::text,
           null::timestamptz, null::text, null::integer, false, p_to < private.business_today();
end;
$$;

-- Each employee of the period: the copy if it is a closed fortnight, computed now if not.
create function public.payroll_lines(p_from date, p_to date, p_method text)
returns table (
  employee_id uuid, employee_name text, active_days integer, period_days integer, base_salary integer,
  base_pay integer, commission_pct integer, commissions integer, total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_payroll();
  perform private.payroll_check(p_from, p_to, p_method);
  if private.is_fortnight(p_from, p_to) and exists (select 1 from public.payrolls p where p.period_start = p_from) then
    return query
      select l.employee_id, l.employee_name, l.active_days::integer, l.period_days::integer, l.base_salary,
             l.base_pay, l.commission_pct::integer, l.commissions, l.total
      from public.payroll_lines l
      join public.payrolls p on p.id = l.payroll_id
      where p.period_start = p_from
      order by l.employee_name, l.employee_id;
    return;
  end if;
  return query select * from private.payroll_lines_live(p_from, p_to, p_method);
end;
$$;

-- The services of an employee in the period, with their commission, the same way.
create function public.payroll_items(p_from date, p_to date, p_employee uuid)
returns table (
  order_id uuid, order_number bigint, closed_at timestamptz, service_name text, price integer,
  share_pct integer, commission numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_payroll();
  perform private.payroll_check(p_from, p_to, 'commercial');
  if private.is_fortnight(p_from, p_to) and exists (select 1 from public.payrolls p where p.period_start = p_from) then
    return query
      select i.order_id, i.order_number, i.closed_at, i.service_name, i.price, i.share_pct::integer,
             i.commission
      from public.payroll_items i
      join public.payroll_lines l on l.id = i.payroll_line_id
      join public.payrolls p on p.id = l.payroll_id
      where p.period_start = p_from and l.employee_id = p_employee
      order by i.closed_at, i.order_number, i.line_position;
    return;
  end if;
  return query
    select i.order_id, i.order_number, i.closed_at, i.service_name, i.price, i.share_pct::integer,
           i.commission
    from private.payroll_items_live(p_from, p_to) i
    where i.employee_id = p_employee
    order by i.closed_at, i.order_number, i.line_position;
end;
$$;

-- How an employee's base salary of the period was reached (CA-04): a piece per fortnight it touches;
-- a closed fortnight, the piece it kept.
create function public.payroll_base_parts(p_from date, p_to date, p_method text, p_employee uuid)
returns table (
  part_from date, part_to date, part_days integer, active_days integer, paid_days integer, divisor integer,
  amount numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin_for_payroll();
  perform private.payroll_check(p_from, p_to, p_method);
  if private.is_fortnight(p_from, p_to) and exists (select 1 from public.payrolls p where p.period_start = p_from) then
    return query
      select p.period_start, p.period_end, l.period_days::integer, l.active_days::integer, l.paid_days::integer,
             l.divisor::integer, l.base_pay::numeric
      from public.payroll_lines l
      join public.payrolls p on p.id = l.payroll_id
      where p.period_start = p_from and l.employee_id = p_employee;
    return;
  end if;
  return query
    select b.part_from, b.part_to, b.part_days, b.active_days, b.paid_days, b.divisor, b.amount
    from private.payroll_base_parts_live(p_from, p_to, p_method) b
    where b.employee_id = p_employee
    order by b.part_from;
end;
$$;

-- Closing and regenerating (HU-03) ------------------------------------------------------------------------------
create function public.close_payroll(p_start date, p_method text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_admin_for_payroll();
  perform private.payroll_check(p_start, p_start, p_method);
  if p_start <> private.fortnight_start(p_start) then
    raise exception 'only a fortnight is closed' using hint = 'payroll_not_fortnight';
  end if;
  -- Two closings of the same fortnight at once: the second waits, then finds it closed.
  perform pg_advisory_xact_lock(hashtext('payroll'), hashtext(p_start::text));
  if private.fortnight_end(p_start) >= private.business_today() then
    raise exception 'the fortnight has not ended' using hint = 'payroll_period_open';
  end if;
  if exists (select 1 from public.payrolls p where p.period_start = p_start) then
    raise exception 'the fortnight is already closed' using hint = 'payroll_already_closed';
  end if;

  insert into public.payrolls (period_start, period_end, base_method, closed_by, closed_at)
  values (p_start, private.fortnight_end(p_start), p_method, (select auth.uid()), private.agenda_now())
  returning id into v_id;
  perform private.payroll_write(v_id);
  return v_id;
end;
$$;

-- Computes a closed fortnight again with the data of now and the method chosen now (CA-12, CA-16).
create function public.regenerate_payroll(p_start date, p_method text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payroll public.payrolls;
begin
  perform private.require_admin_for_payroll();
  perform private.payroll_check(p_start, p_start, p_method);
  perform pg_advisory_xact_lock(hashtext('payroll'), hashtext(p_start::text));
  select * into v_payroll from public.payrolls p where p.period_start = p_start for update;
  if not found then
    raise exception 'the fortnight is not closed' using hint = 'payroll_not_closed';
  end if;

  delete from public.payroll_lines where payroll_id = v_payroll.id;
  update public.payrolls
     set previous_total = v_payroll.total, base_method = p_method, regenerated_by = (select auth.uid()),
         regenerated_at = private.agenda_now()
   where id = v_payroll.id;
  perform private.payroll_write(v_payroll.id);
  return v_payroll.id;
end;
$$;

revoke execute on function public.payroll_period(date, date, text), public.payroll_lines(date, date, text),
  public.payroll_items(date, date, uuid), public.payroll_base_parts(date, date, text, uuid),
  public.close_payroll(date, text), public.regenerate_payroll(date, text)
  from public, anon;
grant execute on function public.payroll_period(date, date, text), public.payroll_lines(date, date, text),
  public.payroll_items(date, date, uuid), public.payroll_base_parts(date, date, text, uuid),
  public.close_payroll(date, text), public.regenerate_payroll(date, text)
  to authenticated, service_role;
