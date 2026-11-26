import 'server-only';

import { Constants } from '@motorismo/supabase/types';

import type { CustomerStatus } from '@web/modules/auth/types/auth.types';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  type CustomerFilters,
  matchingPlate,
  pageRange,
  toLikePattern,
} from '@web/modules/customers/utils/customers-filter.utils';
import type { MatchedPlate } from '@web/modules/work-orders/utils/plate-search.utils';

const LIST_COLUMNS =
  'id, full_name, email, phone, status, origin, avatar_url, created_at, vehicle_plates, erased_at';

/**
 * One page of customers for the staff list (spec 004, HU-04), newest first (CA-15), read with the
 * user's own session (RLS). The search and the status filter apply to ALL customers, not only to
 * the visible page (RF-05); the search ignores case and accents (CA-16).
 */
export const listCustomers = async ({ q, status, page }: CustomerFilters) => {
  const supabase = await createSupabaseServerClient();
  const [from, to] = pageRange(page);

  let query = supabase
    .from('customers')
    .select(LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .order('id')
    .range(from, to);
  if (q) query = query.ilike('search_text', toLikePattern(q));
  if (status === 'active') query = query.neq('status', 'disabled');
  else if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  // Asking for a page past the end answers 416 (PGRST103): treat it as an empty page.
  if (error?.code === 'PGRST103') return { rows: [], total: count ?? 0 };
  if (error) throw new Error(`Could not list customers: ${error.message}`);
  return { rows: await withMatchedPlates(supabase, data, q), total: count ?? 0 };
};

/**
 * The active plate each customer was found by (spec 005, CA-19), with its city and that city's own
 * legend, to draw it whole in the row (spec 023, CA-12). Null when the search matched something else.
 */
const withMatchedPlates = async <Row extends { vehicle_plates: string }>(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: Row[],
  q: string | undefined
): Promise<(Row & { matched_plate: MatchedPlate | null })[]> => {
  const matched = rows.map((row) => (q ? matchingPlate(row.vehicle_plates, q) : null));
  const plates = matched.filter((plate): plate is string => !!plate);
  const cities = new Map<string, { name: string; plate_legend: string | null } | null>();
  if (plates.length) {
    const { data, error } = await supabase
      .from('vehicles')
      .select('plate, plate_city:municipalities(name, plate_legend)')
      .in('plate', plates)
      .is('retired_at', null);
    if (error) throw new Error(`Could not read the plates' cities: ${error.message}`);
    for (const { plate, plate_city } of data) if (plate) cities.set(plate, plate_city);
  }
  return rows.map((row, index) => {
    const plate = matched[index];
    const city = plate ? cities.get(plate) : null;
    return {
      ...row,
      matched_plate: plate
        ? { plate, city: city?.name ?? null, legend: city?.plate_legend ?? null }
        : null,
    };
  });
};

export type CustomerListRow = Awaited<ReturnType<typeof listCustomers>>['rows'][number];

/** Totals per status for the summary cards (CA-17); RLS applies. */
export const countCustomersByStatus = async (): Promise<Record<CustomerStatus, number>> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('customer_status_counts');
  if (error) throw new Error(`Could not count customers: ${error.message}`);

  const counts = Object.fromEntries(
    Constants.public.Enums.customer_status.map((status) => [status, 0])
  ) as Record<CustomerStatus, number>;
  for (const { status, total } of data) counts[status] = total;
  return counts;
};

/** A customer record with who registered it at the counter (CA-18), or null. */
export const getCustomer = async (id: string) => {
  const supabase = await createSupabaseServerClient();
  const { data: customer, error } = await supabase
    .from('customers')
    .select(`${LIST_COLUMNS}, user_id, consent_at, disabled_at, erased_at`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the customer: ${error.message}`);
  if (!customer) return null;

  const { data: registrarName } = await supabase.rpc('customer_registrar_name', {
    p_customer_id: id,
  });
  return { ...customer, registrar_name: registrarName ?? null };
};

export type CustomerRecord = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;
