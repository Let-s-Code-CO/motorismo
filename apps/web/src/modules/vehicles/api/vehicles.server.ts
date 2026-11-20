import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

const COLUMNS =
  'id, vehicle_type, vehicle_class, displacement_cc, color, plate, plate_city_code, retired_at, created_at, brand:vehicle_brands(name), line:vehicle_lines(name), plate_city:municipalities(name)';

/**
 * The vehicles of a customer (spec 005), read with the user's own session: staff see any
 * customer's, a customer only their own (RLS, CA-26). Active ones newest first (CA-04); retired
 * ones apart, most recently retired first (RF-06).
 */
export const listCustomerVehicles = async (customerId: string) => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('vehicles')
    .select(COLUMNS)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .order('id');
  if (error) throw new Error(`Could not list the vehicles: ${error.message}`);

  const active = data.filter((vehicle) => vehicle.retired_at === null);
  const retired = data
    .filter((vehicle) => vehicle.retired_at !== null)
    .sort((a, b) => (b.retired_at ?? '').localeCompare(a.retired_at ?? ''));
  return { active, retired };
};

export type VehicleView = Awaited<ReturnType<typeof listCustomerVehicles>>['active'][number];
