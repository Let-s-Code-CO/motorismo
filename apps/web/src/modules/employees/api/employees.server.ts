import 'server-only';

import type { Tables } from '@motorismo/supabase/types';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

export type EmployeeDetails = Pick<
  Tables<'employee_details'>,
  'document_type' | 'document_number' | 'phone' | 'commission_pct'
>;

export type EmployeeRow = Pick<Tables<'employees'>, 'id' | 'full_name' | 'disabled_at'> & {
  /** Document, phone and commission: only an admin gets them (RN-07). */
  details: EmployeeDetails | null;
};

/**
 * The employees by name (spec 007, RF-04), read with the user's own session. An admin gets the
 * active and the disabled ones with their private details; an operator asks only for names, and
 * RLS gives them only the active employees (CA-16).
 */
export const listEmployees = async (isAdmin: boolean): Promise<EmployeeRow[]> => {
  const supabase = await createSupabaseServerClient();

  if (!isAdmin) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, full_name, disabled_at')
      .order('full_name');
    if (error) throw new Error(`Could not list employees: ${error.message}`);
    return data.map((employee) => ({ ...employee, details: null }));
  }

  const { data, error } = await supabase
    .from('employees')
    .select(
      'id, full_name, disabled_at, employee_details(document_type, document_number, phone, commission_pct)'
    )
    .order('full_name');
  if (error) throw new Error(`Could not list employees: ${error.message}`);
  return data.map(({ employee_details, ...employee }) => ({
    ...employee,
    details: employee_details,
  }));
};
