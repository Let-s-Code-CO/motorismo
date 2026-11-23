import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type {
  PayrollItem,
  PayrollLine,
  PayrollMonth,
} from '@web/modules/reports/types/reports.types';
import { monthStart } from '@web/modules/reports/utils/payroll-month.utils';

/**
 * A month's payroll (spec 016), read with the admin's own session: the database functions refuse
 * anyone else (RN-08). A closed month comes from its copy, one not closed is computed now (CA-12,
 * CA-15). `month` is `YYYY-MM`.
 */
export const getPayrollMonth = async (month: string): Promise<PayrollMonth> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('payroll_month', { p_month: monthStart(month) });
  if (error) throw new Error(`Could not read the payroll of ${month}: ${error.message}`);
  const [state] = data;
  if (!state) throw new Error(`The payroll of ${month} has no state`);
  return state as PayrollMonth;
};

/** Each employee of the month, by name (CA-05). */
export const getPayrollLines = async (month: string): Promise<PayrollLine[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('payroll_lines', { p_month: monthStart(month) });
  if (error) throw new Error(`Could not read the payroll lines of ${month}: ${error.message}`);
  return data;
};

/** The services an employee took part in that month, oldest first (CA-11). */
export const getPayrollItems = async (
  month: string,
  employeeId: string
): Promise<PayrollItem[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('payroll_items', {
    p_month: monthStart(month),
    p_employee: employeeId,
  });
  if (error) throw new Error(`Could not read the payroll detail of ${month}: ${error.message}`);
  return data;
};
