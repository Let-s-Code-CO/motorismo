import 'server-only';

import { Constants } from '@motorismo/supabase/types';

import type { CustomerStatus } from '@web/modules/auth/types/auth.types';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  type CustomerFilters,
  pageRange,
  toLikePattern,
} from '@web/modules/customers/utils/customers-filter.utils';

const LIST_COLUMNS = 'id, full_name, email, phone, status, origin, avatar_url, created_at';

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
  return { rows: data, total: count ?? 0 };
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
    .select(`${LIST_COLUMNS}, user_id, consent_at, disabled_at`)
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
