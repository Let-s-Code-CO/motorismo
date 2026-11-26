'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  type PayrollErrorKey,
  fromPayrollError,
} from '@web/modules/reports/utils/payroll-errors.utils';
import { PAYROLL_PATH, fortnightOf } from '@web/modules/reports/utils/payroll-period.utils';
import { isAgendaDate } from '@web/modules/reservations/utils/agenda-date.utils';

/** A fortnight by its first day (the 1st or the 16th) and one of the two methods (RN-02). */
const fortnightSchema = z.object({
  start: z
    .string()
    .refine(isAgendaDate)
    .refine((start) => fortnightOf(start) === start),
  method: z.enum(['commercial', 'actual']),
});

/**
 * Runs close_payroll or regenerate_payroll for a fortnight (spec 020, HU-03) with the admin's own
 * session: only an active admin gets this far, and the database checks again (spec 016, RN-08),
 * and whether the fortnight may be closed (RN-04) or regenerated, with the method chosen (CA-16).
 */
const runOnMonth = async (
  fn: 'close_payroll' | 'regenerate_payroll',
  input: unknown
): Promise<ActionResult<PayrollErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = fortnightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(fn, {
    p_start: parsed.data.start,
    p_method: parsed.data.method,
  });
  if (error) return { ok: false, error: fromPayrollError(error) };

  // The payroll and the detail of each employee of that fortnight.
  revalidatePath(PAYROLL_PATH, 'layout');
  return { ok: true };
};

/** Closes an ended fortnight: its payroll stays as it is now, with its method (CA-11, CA-16). */
export const closePayroll = async (input: unknown) => runOnMonth('close_payroll', input);

/**
 * Computes a closed fortnight again with the data of now and the method chosen now, keeping the total
 * before (CA-12, CA-16).
 */
export const regeneratePayroll = async (input: unknown) => runOnMonth('regenerate_payroll', input);
