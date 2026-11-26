import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { CLOSED_PAGE_SIZE } from '@web/modules/work-orders/constants/work-orders.constants';
import type {
  WorkOrderDetail,
  WorkOrderSummary,
} from '@web/modules/work-orders/types/work-orders.types';
import { countOpenOrders } from '@web/modules/work-orders/utils/open-orders-count.lib';

/** In progress and queued, for the staff home, with the person's session (spec 009, CA-07). */
export const openOrdersCount = async () => countOpenOrders(await createSupabaseServerClient());

/**
 * The open orders by turn (spec 008, CA-18; spec 012, RN-04): their arrival, or the time they
 * reserved; the queue's tie-break (reservation first) is in queue.utils.
 */
export const listOpenOrders = async (): Promise<WorkOrderSummary[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('work_order_summaries')
    .select('*')
    .eq('status', 'open')
    .order('turn_at')
    .order('opened_at');
  if (error) throw new Error(`Could not list the open orders: ${error.message}`);
  return data;
};

/** The closed and voided orders, newest first, one page at a time (CA-19). */
export const listClosedOrders = async (page: number) => {
  const supabase = await createSupabaseServerClient();
  const from = (page - 1) * CLOSED_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from('work_order_summaries')
    .select('*', { count: 'exact' })
    .neq('status', 'open')
    .order('opened_at', { ascending: false })
    .range(from, from + CLOSED_PAGE_SIZE - 1);
  if (error?.code === 'PGRST103') return { rows: [], total: count ?? 0 };
  if (error) throw new Error(`Could not list the closed orders: ${error.message}`);
  return { rows: data, total: count ?? 0 };
};

/** Every order of a customer, newest first (CA-15, CA-16). */
export const listCustomerOrders = async (customerId: string): Promise<WorkOrderSummary[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('work_order_summaries')
    .select('*')
    .eq('customer_id', customerId)
    .order('opened_at', { ascending: false });
  if (error) throw new Error(`Could not list the customer's orders: ${error.message}`);
  return data;
};

/** An order with its lines, employees and payments (CA-20), or null if it does not exist. */
export const getOrder = async (id: string): Promise<WorkOrderDetail | null> => {
  const supabase = await createSupabaseServerClient();
  const [summary, lines, payments] = await Promise.all([
    supabase.from('work_order_summaries').select('*').eq('id', id).maybeSingle(),
    supabase
      .from('work_order_lines')
      .select(
        'id, position, service_id, name, price, estimated_minutes, work_order_line_employees(share_pct, employees(id, full_name)), service:services(includes:service_inclusions!service_inclusions_service_id_fkey(included:services!service_inclusions_included_id_fkey(name)))'
      )
      .eq('work_order_id', id)
      .order('position'),
    supabase.from('work_order_payments').select('method, amount').eq('work_order_id', id),
  ]);
  if (summary.error) throw new Error(`Could not load the order: ${summary.error.message}`);
  if (lines.error) throw new Error(`Could not load the order lines: ${lines.error.message}`);
  if (payments.error) throw new Error(`Could not load the payments: ${payments.error.message}`);
  if (!summary.data) return null;

  return {
    summary: summary.data,
    lines: lines.data.map(({ work_order_line_employees, service, ...line }) => ({
      ...line,
      // Spec 024, CA-27: what a package includes.
      includes: (service?.includes ?? []).map(({ included }) => included.name),
      employees: work_order_line_employees.map(({ share_pct, employees }) => ({
        employee_id: employees.id,
        full_name: employees.full_name,
        share_pct,
      })),
    })),
    payments: payments.data,
  };
};
