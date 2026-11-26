import { createSupabaseBrowserClient } from '@web/modules/core/lib/supabase-browser.lib';
import { toLikePattern } from '@web/modules/customers/utils/customers-filter.utils';
import type {
  EmployeeOption,
  PickerCustomer,
  PickerVehicle,
  ServiceOption,
  WorkOrderSummary,
} from '@web/modules/work-orders/types/work-orders.types';
import { matchedPlates, plateQuery } from '@web/modules/work-orders/utils/plate-search.utils';

/** How many customers «Nueva orden» suggests while typing. */
const SEARCH_LIMIT = 8;

/**
 * Active customers matching a name, phone, email or plate (spec 008, CA-01), read from the browser
 * with the staff member's session (RLS). Disabled customers are not offered (CA-10).
 * Each one says the active plate it matched by, if any (spec 022, CA-11).
 */
export const searchCustomers = async (q: string): Promise<PickerCustomer[]> => {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, email')
    .ilike('search_text', toLikePattern(q))
    .is('disabled_at', null)
    .order('full_name')
    .limit(SEARCH_LIMIT);
  if (error) throw new Error(`Could not search customers: ${error.message}`);

  const query = plateQuery(q);
  if (!query || !data.length) return data;
  const { data: vehicles, error: plateError } = await supabase
    .from('vehicles')
    .select('customer_id, plate, plate_city:municipalities(name, plate_legend)')
    .in(
      'customer_id',
      data.map(({ id }) => id)
    )
    .is('retired_at', null)
    .ilike('plate', `%${query}%`);
  if (plateError) throw new Error(`Could not search plates: ${plateError.message}`);
  const plates = matchedPlates(vehicles, query);
  return data.map((customer) => ({ ...customer, matchedPlate: plates.get(customer.id) ?? null }));
};

/**
 * The active vehicles of a customer, newest first, each with its open order if it has one (only
 * one open order per vehicle: «Nueva orden» offers to open that one instead).
 */
export const fetchCustomerVehicles = async (customerId: string): Promise<PickerVehicle[]> => {
  const supabase = createSupabaseBrowserClient();
  const [vehicles, open] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, vehicle_type, plate, vehicle_brands(name), vehicle_lines(name)')
      .eq('customer_id', customerId)
      .is('retired_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('work_order_summaries')
      .select('id, number, vehicle_id')
      .eq('customer_id', customerId)
      .eq('status', 'open'),
  ]);
  if (vehicles.error) throw new Error(`Could not load the vehicles: ${vehicles.error.message}`);
  if (open.error) throw new Error(`Could not load the open orders: ${open.error.message}`);

  return vehicles.data.map((vehicle) => {
    const order = open.data.find(({ vehicle_id }) => vehicle_id === vehicle.id);
    return {
      id: vehicle.id,
      vehicle_type: vehicle.vehicle_type,
      plate: vehicle.plate,
      brand_name: vehicle.vehicle_brands.name,
      line_name: vehicle.vehicle_lines?.name ?? null,
      openOrder: order?.id && order.number ? { id: order.id, number: order.number } : null,
    };
  });
};

/** The services that can be added to an order: active ones (RN-04). */
export const fetchActiveServices = async (): Promise<ServiceOption[]> => {
  const { data, error } = await createSupabaseBrowserClient()
    .from('services')
    .select('id, name, price_motorcycle, price_car, price_bicycle, estimated_minutes')
    .is('disabled_at', null)
    .order('name');
  if (error) throw new Error(`Could not load the services: ${error.message}`);
  return data;
};

/** The employees that can be assigned to a line: active ones (RN-04). */
export const fetchActiveEmployees = async (): Promise<EmployeeOption[]> => {
  const { data, error } = await createSupabaseBrowserClient()
    .from('employees')
    .select('id, full_name')
    .is('disabled_at', null)
    .order('full_name');
  if (error) throw new Error(`Could not load the employees: ${error.message}`);
  return data;
};

/** Every order of a customer, newest first: their history while a new order is opened (CA-15). */
export const fetchCustomerOrders = async (customerId: string): Promise<WorkOrderSummary[]> => {
  const { data, error } = await createSupabaseBrowserClient()
    .from('work_order_summaries')
    .select('*')
    .eq('customer_id', customerId)
    .order('opened_at', { ascending: false });
  if (error) throw new Error(`Could not load the customer's orders: ${error.message}`);
  return data;
};
