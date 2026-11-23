-- Spec 016 — the payroll of the employees: base salary for the days active plus commissions.
--
-- * employee_details.base_salary: private like the commission (spec 007, RN-07), 0 by default
--   (CA-01 to CA-04); save_employee takes it.
-- * employee_active_periods: when each employee was active, kept by a trigger on employees
--   (register, disable, reactivate), so a month knows its active days (RN-04).
-- * The payroll of a month is computed by private.payroll_lines_live / payroll_items_live:
--   value × share × commission % for the services of the orders closed in the month in Colombia,
--   discount ignored (RN-01 to RN-03); base × active days ÷ days of the month (RN-04); rounded once
--   per employee (RN-05); the base and the commission the employee has now (RN-09).
-- * close_payroll keeps a fixed copy (payrolls, payroll_lines, payroll_items) of an ended month
--   (RN-06, RN-07); regenerate_payroll writes it again and keeps the total before (CA-16);
--   payroll_month says whether something changed since (CA-17).
-- * Admin only, in the database (RN-08): every function refuses anyone else; the tables are read by
--   an admin and written only by the functions.
--
-- seeds: 04_catalogs.sql gives the employees a base salary, registers them 90 days ago and disables
-- Diego 20 days ago (a month with part of his salary).

-- Base salary (HU-01) ---------------------------------------------------------------------------------
alter table public.employee_details
  add column base_salary integer not null default 0 check (base_salary >= 0);
comment on column public.employee_details.base_salary is
  'Monthly base salary in whole pesos (spec 016); private, admin only (spec 007, RN-07).';

grant insert (base_salary), update (base_salary) on table public.employee_details to authenticated;

-- save_employee takes the base salary. Last and optional, so the calls of spec 007 still work: null
-- registers 0 and, on a correction, keeps the one the employee had.
drop function public.save_employee(text, public.document_type, text, integer, text, uuid);

create function public.save_employee(
  p_full_name text,
  p_document_type public.document_type,
  p_document_number text,
  p_commission_pct integer,
  p_phone text default null,
  -- null registers a new employee; an id corrects that one.
  p_id uuid default null,
  p_base_salary integer default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if v_id is null then
    insert into public.employees (full_name) values (p_full_name) returning id into v_id;
    insert into public.employee_details
      (employee_id, document_type, document_number, phone, commission_pct, base_salary)
    values (v_id, p_document_type, p_document_number, p_phone, p_commission_pct, coalesce(p_base_salary, 0));
    return v_id;
  end if;

  update public.employees set full_name = p_full_name where id = v_id;
  if not found then
    raise exception 'employee not found' using errcode = 'no_data_found', hint = 'employee_not_found';
  end if;
  update public.employee_details
     set document_type = p_document_type, document_number = p_document_number,
         phone = p_phone, commission_pct = p_commission_pct,
         base_salary = coalesce(p_base_salary, base_salary)
   where employee_id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.save_employee(text, public.document_type, text, integer, text, uuid, integer)
  from public, anon;
grant execute on function public.save_employee(text, public.document_type, text, integer, text, uuid, integer)
  to authenticated, service_role;

-- Active periods (RN-04) ------------------------------------------------------------------------------
create table public.employee_active_periods (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  started_at timestamptz not null,
  -- null while still active
  ended_at timestamptz,
  check (ended_at is null or ended_at >= started_at)
);
create index employee_active_periods_employee_idx on public.employee_active_periods (employee_id);

comment on table public.employee_active_periods is
  'When each employee was active (spec 016, RN-04), kept by a trigger on employees.';

-- The employees of before: active from their registration until they were disabled (if they were).
insert into public.employee_active_periods (employee_id, started_at, ended_at)
select id, created_at, disabled_at from public.employees;

-- SECURITY DEFINER: whoever registers, disables or reactivates an employee (an admin, through RLS)
-- cannot write the periods themselves.
create function public.employees_active_periods()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.employee_active_periods (employee_id, started_at, ended_at)
    values (new.id, new.created_at, new.disabled_at);
  elsif old.disabled_at is null and new.disabled_at is not null then
    update public.employee_active_periods set ended_at = new.disabled_at
     where employee_id = new.id and ended_at is null;
  elsif old.disabled_at is not null and new.disabled_at is null then
    insert into public.employee_active_periods (employee_id, started_at)
    values (new.id, private.agenda_now());
  end if;
  return null;
end;
$$;

create trigger employees_active_periods
  after insert or update of disabled_at on public.employees
  for each row execute function public.employees_active_periods();

revoke all on function public.employees_active_periods() from public, anon, authenticated;

alter table public.employee_active_periods enable row level security;
create policy employee_active_periods_select_admin
  on public.employee_active_periods for select to authenticated
  using ((select public.is_admin()));
revoke all on table public.employee_active_periods from anon, authenticated;
grant select on table public.employee_active_periods to authenticated;

-- Closed payrolls (HU-03) -----------------------------------------------------------------------------
create table public.payrolls (
  id uuid primary key default gen_random_uuid(),
  -- the first day of the month
  month date not null unique check (month = date_trunc('month', month)::date),
  total integer not null default 0,
  closed_by uuid not null references public.profiles (id),
  closed_at timestamptz not null,
  regenerated_by uuid references public.profiles (id),
  regenerated_at timestamptz,
  -- the total before the last regeneration (CA-16)
  previous_total integer
);

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_id uuid not null references public.payrolls (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  employee_name text not null,
  active_days smallint not null,
  month_days smallint not null,
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
  'A closed month of payroll (spec 016, HU-03): a fixed copy, written only by close/regenerate_payroll.';

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

-- The computation (RN-01 to RN-05, RN-09) ---------------------------------------------------------------
-- How many days of the month the employee was active at some moment, in Colombia (RN-04).
create function private.active_days(p_employee uuid, p_month date)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_month, (p_month + interval '1 month' - interval '1 day')::date, interval '1 day') d(day)
  where exists (
    select 1 from public.employee_active_periods p
    where p.employee_id = p_employee
      and (p.started_at at time zone 'America/Bogota')::date <= d.day::date
      and (p.ended_at is null or (p.ended_at at time zone 'America/Bogota')::date >= d.day::date));
$$;

-- Each service of the orders closed in the month and each employee in it, with their commission:
-- value × share × commission %, the order's discount ignored (RN-01 to RN-03).
create function private.payroll_items_live(p_month date)
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
    and (o.closed_at at time zone 'America/Bogota')::date
        between p_month and (p_month + interval '1 month' - interval '1 day')::date;
$$;

-- Each employee of the month: active some day or with commissions in it (CA-10).
create function private.payroll_lines_live(p_month date)
returns table (
  employee_id uuid, employee_name text, active_days integer, month_days integer, base_salary integer,
  base_pay integer, commission_pct integer, commissions integer, total integer
)
language sql
stable
set search_path = ''
as $$
  with month as (
    select extract(day from p_month + interval '1 month' - interval '1 day')::integer as days
  ),
  sums as (
    select i.employee_id, sum(i.commission) as commission
    from private.payroll_items_live(p_month) i
    group by i.employee_id
  ),
  people as (
    select e.id, e.full_name, private.active_days(e.id, p_month) as days,
           coalesce(d.base_salary, 0) as base, coalesce(d.commission_pct, 0)::integer as pct,
           s.commission
    from public.employees e
    left join public.employee_details d on d.employee_id = e.id
    left join sums s on s.employee_id = e.id
  ),
  computed as (
    select p.id, p.full_name, p.days, m.days as month_days, p.base,
           round(p.base::numeric * p.days / m.days)::integer as base_pay, p.pct,
           coalesce(round(p.commission), 0)::integer as commissions, p.commission
    from people p cross join month m
    where p.days > 0 or p.commission is not null
  )
  select c.id, c.full_name, c.days, c.month_days, c.base, c.base_pay, c.pct, c.commissions,
         c.base_pay + c.commissions
  from computed c
  order by c.full_name, c.id;
$$;

-- Writes the fixed copy of a month into a payroll (lines, detail and total).
create function private.payroll_write(p_payroll uuid, p_month date)
returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.payroll_lines (payroll_id, employee_id, employee_name, active_days, month_days,
                                    base_salary, base_pay, commission_pct, commissions, total)
  select p_payroll, l.employee_id, l.employee_name, l.active_days, l.month_days, l.base_salary,
         l.base_pay, l.commission_pct, l.commissions, l.total
  from private.payroll_lines_live(p_month) l;

  insert into public.payroll_items (payroll_line_id, line_id, order_id, order_number, closed_at,
                                    line_position, service_name, price, share_pct, commission)
  select pl.id, i.line_id, i.order_id, i.order_number, i.closed_at, i.line_position, i.service_name,
         i.price, i.share_pct, i.commission
  from private.payroll_items_live(p_month) i
  join public.payroll_lines pl on pl.payroll_id = p_payroll and pl.employee_id = i.employee_id;

  update public.payrolls
     set total = (select coalesce(sum(l.total), 0) from public.payroll_lines l where l.payroll_id = p_payroll)
   where id = p_payroll;
end;
$$;

-- CA-17: whether regenerating would give another result (lines or detail differ, either way).
create function private.payroll_changed(p_payroll uuid, p_month date)
returns boolean
language sql
stable
set search_path = ''
as $$
  with live_lines as (
    select employee_id, active_days, month_days, base_salary, base_pay, commission_pct, commissions, total
    from private.payroll_lines_live(p_month)
  ),
  kept_lines as (
    select employee_id, active_days::integer, month_days::integer, base_salary, base_pay,
           commission_pct::integer, commissions, total
    from public.payroll_lines where payroll_id = p_payroll
  ),
  live_items as (
    select employee_id, line_id, price, share_pct, commission from private.payroll_items_live(p_month)
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

create function private.require_admin_for_payroll()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'only an admin sees the payroll' using errcode = '42501', hint = 'payroll_admin_only';
  end if;
end;
$$;

revoke all on function private.active_days(uuid, date), private.payroll_items_live(date),
  private.payroll_lines_live(date), private.payroll_write(uuid, date),
  private.payroll_changed(uuid, date), private.require_admin_for_payroll() from public;

-- Reading a month (HU-02) -------------------------------------------------------------------------------
-- Its state: provisional (computed now) or closed (the copy), who closed or regenerated it and
-- when, the total before regenerating, whether something changed since, and whether it may be
-- closed: an ended month not closed yet (RN-06). Any day of the month names it.
create function public.payroll_month(p_month date)
returns table (
  month date, status text, total integer, closed_at timestamptz, closed_by_name text,
  regenerated_at timestamptz, regenerated_by_name text, previous_total integer,
  changed_since_close boolean, can_close boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_payroll public.payrolls;
begin
  perform private.require_admin_for_payroll();
  select * into v_payroll from public.payrolls p where p.month = v_month;
  if found then
    return query
      select v_month, 'closed'::text, v_payroll.total, v_payroll.closed_at,
             (select pr.full_name from public.profiles pr where pr.id = v_payroll.closed_by),
             v_payroll.regenerated_at,
             (select pr.full_name from public.profiles pr where pr.id = v_payroll.regenerated_by),
             v_payroll.previous_total, private.payroll_changed(v_payroll.id, v_month), false;
    return;
  end if;
  return query
    select v_month, 'provisional'::text,
           (select coalesce(sum(l.total), 0)::integer from private.payroll_lines_live(v_month) l),
           null::timestamptz, null::text, null::timestamptz, null::text, null::integer, false,
           v_month < date_trunc('month', private.business_today())::date;
end;
$$;

-- Each employee of the month: the copy if it is closed (CA-15), computed now if not (CA-12).
create function public.payroll_lines(p_month date)
returns table (
  employee_id uuid, employee_name text, active_days integer, month_days integer, base_salary integer,
  base_pay integer, commission_pct integer, commissions integer, total integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  perform private.require_admin_for_payroll();
  if exists (select 1 from public.payrolls p where p.month = v_month) then
    return query
      select l.employee_id, l.employee_name, l.active_days::integer, l.month_days::integer, l.base_salary,
             l.base_pay, l.commission_pct::integer, l.commissions, l.total
      from public.payroll_lines l
      join public.payrolls p on p.id = l.payroll_id
      where p.month = v_month
      order by l.employee_name, l.employee_id;
    return;
  end if;
  return query select * from private.payroll_lines_live(v_month);
end;
$$;

-- The services of an employee in the month, with their commission (CA-11), the same way.
create function public.payroll_items(p_month date, p_employee uuid)
returns table (
  order_id uuid, order_number bigint, closed_at timestamptz, service_name text, price integer,
  share_pct integer, commission numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
begin
  perform private.require_admin_for_payroll();
  if exists (select 1 from public.payrolls p where p.month = v_month) then
    return query
      select i.order_id, i.order_number, i.closed_at, i.service_name, i.price, i.share_pct::integer,
             i.commission
      from public.payroll_items i
      join public.payroll_lines l on l.id = i.payroll_line_id
      join public.payrolls p on p.id = l.payroll_id
      where p.month = v_month and l.employee_id = p_employee
      order by i.closed_at, i.order_number, i.line_position;
    return;
  end if;
  return query
    select i.order_id, i.order_number, i.closed_at, i.service_name, i.price, i.share_pct::integer,
           i.commission
    from private.payroll_items_live(v_month) i
    where i.employee_id = p_employee
    order by i.closed_at, i.order_number, i.line_position;
end;
$$;

-- Closing and regenerating (HU-03) ------------------------------------------------------------------------
create function public.close_payroll(p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_id uuid;
begin
  perform private.require_admin_for_payroll();
  -- Two closings of the same month at once: the second waits, then finds it closed.
  perform pg_advisory_xact_lock(hashtext('payroll'), hashtext(v_month::text));
  if v_month >= date_trunc('month', private.business_today())::date then
    raise exception 'the month has not ended' using hint = 'payroll_month_open';
  end if;
  if exists (select 1 from public.payrolls p where p.month = v_month) then
    raise exception 'the month is already closed' using hint = 'payroll_already_closed';
  end if;

  insert into public.payrolls (month, closed_by, closed_at)
  values (v_month, (select auth.uid()), private.agenda_now())
  returning id into v_id;
  perform private.payroll_write(v_id, v_month);
  return v_id;
end;
$$;

create function public.regenerate_payroll(p_month date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_payroll public.payrolls;
begin
  perform private.require_admin_for_payroll();
  perform pg_advisory_xact_lock(hashtext('payroll'), hashtext(v_month::text));
  select * into v_payroll from public.payrolls p where p.month = v_month for update;
  if not found then
    raise exception 'the month is not closed' using hint = 'payroll_not_closed';
  end if;

  delete from public.payroll_lines where payroll_id = v_payroll.id;
  update public.payrolls
     set previous_total = v_payroll.total, regenerated_by = (select auth.uid()),
         regenerated_at = private.agenda_now()
   where id = v_payroll.id;
  perform private.payroll_write(v_payroll.id, v_month);
  return v_payroll.id;
end;
$$;

revoke execute on function public.payroll_month(date), public.payroll_lines(date),
  public.payroll_items(date, uuid), public.close_payroll(date), public.regenerate_payroll(date)
  from public, anon;
grant execute on function public.payroll_month(date), public.payroll_lines(date),
  public.payroll_items(date, uuid), public.close_payroll(date), public.regenerate_payroll(date)
  to authenticated, service_role;
