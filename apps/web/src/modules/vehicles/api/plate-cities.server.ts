import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { PlateCity } from '@web/modules/vehicles/types/vehicles.types';

/**
 * The municipalities that issue plates, with their own legend (spec 023, HU-03), read with the
 * admin's session. 294 rows: one request is enough (the API's cap is 1,000).
 */
export const getPlateCities = async (): Promise<PlateCity[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('municipalities')
    .select('code, name, department, plate_legend')
    .eq('issues_plates', true)
    .order('code');
  if (error) throw new Error(`Could not load the plate cities: ${error.message}`);
  return data;
};
