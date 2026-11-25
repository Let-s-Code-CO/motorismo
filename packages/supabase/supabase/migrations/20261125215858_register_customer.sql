-- Staff register a customer and, optionally, their first vehicle in one go (spec 022).
--
-- register_customer inserts the customer as staff do today (spec 004, CA-24) and, when a vehicle
-- type is given, registers that vehicle with save_vehicle (spec 005). Both happen in the call's
-- transaction: a refused vehicle (a plate already taken, a car without its class…) undoes the customer,
-- and a refused customer (an email already used) never reaches the vehicle (RN-01).
--
-- It is security invoker: the customer goes through the table's row security (only staff insert,
-- RN-03) and customers_guard (origin, who registered them, consent date, unique email), and the
-- vehicle through save_vehicle's own checks. Nothing is granted beyond what each part already allows.
--
-- seeds: unchanged — a new function; the seeds register customers and vehicles separately.

create function public.register_customer(
  p_full_name text,
  p_email text,
  p_phone text,
  p_vehicle_type public.vehicle_type default null,
  p_vehicle_class public.vehicle_class default null,
  p_brand_name text default null,
  p_line_name text default null,
  p_displacement_cc integer default null,
  p_color public.vehicle_color default null,
  p_plate text default null,
  p_plate_city_code text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_customer_id uuid;
begin
  insert into public.customers (full_name, email, phone)
  values (p_full_name, p_email, p_phone)
  returning id into v_customer_id;

  if p_vehicle_type is not null then
    perform public.save_vehicle(
      p_customer_id => v_customer_id,
      p_vehicle_type => p_vehicle_type,
      p_brand_name => p_brand_name,
      p_color => p_color,
      p_vehicle_class => p_vehicle_class,
      p_line_name => p_line_name,
      p_displacement_cc => p_displacement_cc,
      p_plate => p_plate,
      p_plate_city_code => p_plate_city_code
    );
  end if;

  return v_customer_id;
end;
$$;

comment on function public.register_customer(text, text, text, public.vehicle_type, public.vehicle_class, text,
  text, integer, public.vehicle_color, text, text) is
  'Staff register a customer and, optionally, their first vehicle, together or not at all (spec 022, RN-01). '
  'Security invoker: the customers row security and guard, and save_vehicle, decide what is allowed.';

revoke execute on function public.register_customer(text, text, text, public.vehicle_type, public.vehicle_class, text,
  text, integer, public.vehicle_color, text, text) from public, anon;
grant execute on function public.register_customer(text, text, text, public.vehicle_type, public.vehicle_class, text,
  text, integer, public.vehicle_color, text, text) to authenticated, service_role;
