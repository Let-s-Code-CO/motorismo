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
import { PAYROLL_PATH, monthStart } from '@web/modules/reports/utils/payroll-month.utils';

const monthSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

/**
 * Runs close_payroll or regenerate_payroll for a month (spec 016, HU-03) with the admin's own
 * session: only an active admin gets this far (CA-20), and the database checks again (RN-08), and
 * whether the month may be closed (RN-06) or regenerated.
 */
const runOnMonth = async (
  fn: 'close_payroll' | 'regenerate_payroll',
  input: unknown
): Promise<ActionResult<PayrollErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = monthSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(fn, { p_month: monthStart(parsed.data.month) });
  if (error) return { ok: false, error: fromPayrollError(error) };

  // The payroll and the detail of each employee of that month.
  revalidatePath(PAYROLL_PATH, 'layout');
  return { ok: true };
};

/** Closes an ended month: its payroll stays as it is now (CA-14). */
export const closePayroll = async (input: unknown) => runOnMonth('close_payroll', input);

/** Computes a closed month again with the data of now, keeping the total before (CA-16). */
export const regeneratePayroll = async (input: unknown) => runOnMonth('regenerate_payroll', input);
