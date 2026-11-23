'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { employeeSchema } from '@web/modules/employees/schemas/employee.schema';
import {
  type EmployeesErrorKey,
  fromEmployeesGuardError,
} from '@web/modules/employees/utils/employees-errors.utils';

const EMPLOYEES_PATH = '/employees';

const fieldErrorsOf = (error: z.ZodError) => z.flattenError(error).fieldErrors;

const idSchema = z.object({ id: z.uuid().nullish() });

/**
 * An admin registers (no id) or corrects (with id) an employee (spec 007, CA-07, CA-10).
 * save_employee writes the name and the private details together, with the admin's OWN session:
 * RLS lets only an admin write (RN-01) and the guard refuses a document already taken, saying
 * whether that employee is disabled (CA-09).
 */
export const saveEmployee = async (input: unknown): Promise<ActionResult<EmployeesErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const id = idSchema.safeParse(input);
  const parsed = employeeSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: parsed.success ? undefined : fieldErrorsOf(parsed.error),
    };
  }
  const { full_name, document_type, document_number, phone, commission_pct, base_salary } =
    parsed.data;

  const supabase = await createSupabaseServerClient();
  // Without an id it registers a new employee; without a phone, none is kept.
  const { error } = await supabase.rpc('save_employee', {
    p_full_name: full_name,
    p_document_type: document_type,
    p_document_number: document_number,
    p_commission_pct: commission_pct,
    ...(phone ? { p_phone: phone } : {}),
    ...(id.data.id ? { p_id: id.data.id } : {}),
    // Spec 016: the monthly base salary.
    p_base_salary: base_salary,
  });
  if (error) return { ok: false, error: fromEmployeesGuardError(error) };

  revalidatePath(EMPLOYEES_PATH);
  return { ok: true };
};

const disableSchema = z.object({ id: z.uuid(), disabled: z.boolean() });

/**
 * An admin disables an employee who no longer works here, or reactivates them (CA-12, CA-13).
 * Never deleted (RN-02): disabling keeps the date and every detail.
 */
export const setEmployeeDisabled = async (
  input: unknown
): Promise<ActionResult<EmployeesErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = disableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('employees')
    .update({ disabled_at: parsed.data.disabled ? new Date().toISOString() : null })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: fromEmployeesGuardError(error) };
  if (!data) return { ok: false, error: 'notFound' };

  revalidatePath(EMPLOYEES_PATH);
  return { ok: true };
};
