import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type {
  PayrollBasePart,
  PayrollItem,
  PayrollLine,
  PayrollQuery,
  PayrollState,
} from '@web/modules/reports/types/reports.types';
import { effectiveMethod, periodBounds } from '@web/modules/reports/utils/payroll-period.utils';

/**
 * The payroll of a period (spec 020), read with the admin's own session: the database functions
 * refuse anyone else (spec 016, RN-08). A closed fortnight comes from its copy, with the method it was
 * closed with (CA-12, CA-16); anything else is computed now with the method asked for.
 */
const args = (query: PayrollQuery) => {
  const { from, to } = periodBounds(query.period);
  return { p_from: from, p_to: to, p_method: effectiveMethod(query) };
};

const fail = (what: string, query: PayrollQuery, message: string): never => {
  const { from, to } = periodBounds(query.period);
  throw new Error(`Could not read the payroll ${what} of ${from}–${to}: ${message}`);
};

/** Its kind, state, method and total (CA-01, CA-05, CA-08, CA-12). */
export const getPayrollPeriod = async (query: PayrollQuery): Promise<PayrollState> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('payroll_period', args(query));
  if (error) return fail('state', query, error.message);
  const [state] = data;
  if (!state) return fail('state', query, 'no state');
  return state as PayrollState;
};

/** Each employee of the period, by name (CA-01, CA-04). */
export const getPayrollLines = async (query: PayrollQuery): Promise<PayrollLine[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('payroll_lines', args(query));
  if (error) return fail('lines', query, error.message);
  return data;
};

/** The services an employee took part in during the period, oldest first (CA-04). */
export const getPayrollItems = async (
  query: PayrollQuery,
  employeeId: string
): Promise<PayrollItem[]> => {
  const { p_from, p_to } = args(query);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('payroll_items', {
    p_from,
    p_to,
    p_employee: employeeId,
  });
  if (error) return fail('detail', query, error.message);
  return data;
};

/** How an employee's base salary was reached: a piece per fortnight it touches (CA-04, RN-02). */
export const getPayrollBaseParts = async (
  query: PayrollQuery,
  employeeId: string
): Promise<PayrollBasePart[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('payroll_base_parts', {
    ...args(query),
    p_employee: employeeId,
  });
  if (error) return fail('base salary', query, error.message);
  return data;
};
