import { createSupabaseBrowserClient } from '@web/modules/core/lib/supabase-browser.lib';
import type {
  CatalogItem,
  Municipality,
  VehicleType,
} from '@web/modules/vehicles/types/vehicles.types';

/** An entry with the names it remembers, as the form filters it (spec 018, CA-16). */
const withAliases = ({
  id,
  name,
  aliases,
}: {
  id: string;
  name: string;
  aliases: { name: string }[];
}) => ({
  id,
  name,
  aliases: aliases.map((alias) => alias.name),
});

/**
 * The catalog, read from the browser with the user's session (any session may read it; nobody
 * writes it through the API). Small lists — tens of brands per type, a few lines per brand — so
 * they are loaded whole and filtered in memory while typing (spec 005, CA-10). Each entry comes with
 * the names it remembers (merged into it or before a rename), so typing one suggests it (spec 018,
 * CA-16).
 */
export const fetchBrands = async (type: VehicleType): Promise<CatalogItem[]> => {
  const { data, error } = await createSupabaseBrowserClient()
    .from('vehicle_brands')
    .select('id, name, aliases:vehicle_brand_aliases(name)')
    .eq('vehicle_type', type)
    .order('name');
  if (error) throw new Error(`Could not load the brands: ${error.message}`);
  return data.map(withAliases);
};

export const fetchLines = async (brandId: string): Promise<CatalogItem[]> => {
  const { data, error } = await createSupabaseBrowserClient()
    .from('vehicle_lines')
    .select('id, name, aliases:vehicle_line_aliases(name)')
    .eq('brand_id', brandId)
    .order('name');
  if (error) throw new Error(`Could not load the lines: ${error.message}`);
  return data.map(withAliases);
};

/** The API answers at most this many rows per request (PostgREST max_rows, Supabase default). */
const API_PAGE = 1000;

/**
 * Every municipality a car plate can be issued in (spec 005, RF-07): only those with a transit
 * authority (spec 023, CA-07, RN-04). They are read page by page in a stable order (DANE code) until
 * a page comes back incomplete, since the API caps each answer at 1,000 rows. A refusal fails the
 * whole read: never a partial list.
 */
export const fetchMunicipalities = async (): Promise<Municipality[]> => {
  const supabase = createSupabaseBrowserClient();
  const all: Municipality[] = [];
  for (let from = 0; ; from += API_PAGE) {
    const { data, error } = await supabase
      .from('municipalities')
      .select('code, name, department')
      .eq('issues_plates', true)
      .order('code')
      .range(from, from + API_PAGE - 1);
    if (error) throw new Error(`Could not load the municipalities: ${error.message}`);
    all.push(...data);
    if (data.length < API_PAGE) return all;
  }
};
