import 'server-only';

import type { Tables } from '@motorismo/supabase/types';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { MotorcycleCategory } from '@web/modules/vehicles/constants/motorcycle-categories.constants';

const COLUMNS =
  'id, name, price_motorcycle, motorcycle_prices, price_car, price_bicycle, estimated_minutes, on_quote, description, disabled_at, includes:service_inclusions!service_inclusions_service_id_fkey(included:services!service_inclusions_included_id_fkey(id, name))';

/**
 * A service of the catalog. `motorcycle_prices` is the value per category (spec 024, CA-07), all
 * eight, or null; the database checks its shape. `includes`: the services it includes directly
 * (HU-05, CA-20).
 */
export type ServiceRow = Pick<
  Tables<'services'>,
  | 'id'
  | 'name'
  | 'price_motorcycle'
  | 'price_car'
  | 'price_bicycle'
  | 'estimated_minutes'
  | 'on_quote'
  | 'description'
  | 'disabled_at'
> & {
  motorcycle_prices: Record<MotorcycleCategory, number> | null;
  includes: { id: string; name: string }[];
};

/**
 * The services catalog by name (spec 007, RF-04), read with the user's own session: an admin gets
 * the active and the disabled ones, an operator only the active ones (RLS, CA-15).
 */
export const listServices = async (): Promise<ServiceRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('services').select(COLUMNS).order('name');
  if (error) throw new Error(`Could not list services: ${error.message}`);
  return data.map(({ includes, ...service }) => ({
    ...(service as Omit<ServiceRow, 'includes'>),
    includes: includes.map(({ included }) => included),
  }));
};
