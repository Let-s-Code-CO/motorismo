'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { plateLegendSchema } from '@web/modules/vehicles/schemas/plate-legend.schema';
import {
  type PlateCitiesErrorKey,
  fromPlateCitiesError,
} from '@web/modules/vehicles/utils/plate-cities-errors.utils';

/**
 * An admin sets or clears a municipality's legend for its plates (spec 023, CA-10), with their own
 * session: set_plate_legend checks the role again (CA-11), that the municipality issues plates and
 * the legend's format, and refuses with a reason the screen says. Every plate of that city changes.
 */
export const setPlateLegend = async (
  input: unknown
): Promise<ActionResult<PlateCitiesErrorKey>> => {
  if (!(await getActiveAdmin())) return { ok: false, error: 'forbidden' };

  const parsed = plateLegendSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_plate_legend', {
    p_code: parsed.data.code,
    // Null clears it; the generator types every argument as given.
    p_legend: parsed.data.legend as string,
  });
  if (error) return { ok: false, error: fromPlateCitiesError(error) };

  // The catalog's tabs and every screen that draws a plate of that city.
  revalidatePath('/admin/vehicle-catalog', 'layout');
  return { ok: true };
};
