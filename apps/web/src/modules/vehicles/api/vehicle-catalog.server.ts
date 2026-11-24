import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { catalogLinesSchema } from '@web/modules/vehicles/schemas/vehicle-catalog.schema';
import type { CatalogBrand } from '@web/modules/vehicles/types/vehicle-catalog.types';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';

/**
 * The admin's reading of the catalog of a type (spec 018, CA-01 to CA-03): the brands in
 * alphabetical order, with their origin, when they were added, how many vehicles use them and their
 * lines. The database refuses anyone but the admin (RN-01).
 */
export const getVehicleCatalog = async (type: VehicleType): Promise<CatalogBrand[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('vehicle_catalog', { p_type: type });
  if (error) throw new Error(`Could not load the vehicle catalog: ${error.message}`);
  return data.map(({ lines, ...brand }) => ({ ...brand, lines: catalogLinesSchema.parse(lines) }));
};
