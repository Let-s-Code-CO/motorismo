import { createSupabaseBrowserClient } from '@web/modules/core/lib/supabase-browser.lib';
import type { CatalogItem, VehicleType } from '@web/modules/vehicles/types/vehicles.types';

/**
 * The catalog, read from the browser with the user's session (any session may read it; nobody
 * writes it through the API). Small lists — tens of brands per type, a few lines per brand — so
 * they are loaded whole and filtered in memory while typing (spec 005, CA-10).
 */
export const fetchBrands = async (type: VehicleType): Promise<CatalogItem[]> => {
  const { data, error } = await createSupabaseBrowserClient()
    .from('vehicle_brands')
    .select('id, name')
    .eq('vehicle_type', type)
    .order('name');
  if (error) throw new Error(`Could not load the brands: ${error.message}`);
  return data;
};

export const fetchLines = async (brandId: string): Promise<CatalogItem[]> => {
  const { data, error } = await createSupabaseBrowserClient()
    .from('vehicle_lines')
    .select('id, name')
    .eq('brand_id', brandId)
    .order('name');
  if (error) throw new Error(`Could not load the lines: ${error.message}`);
  return data;
};
