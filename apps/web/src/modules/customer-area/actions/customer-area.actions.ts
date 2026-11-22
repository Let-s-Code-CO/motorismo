'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveCustomer } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  cancelMyReservationSchema,
  myReservationSchema,
} from '@web/modules/customer-area/schemas/customer-area.schema';
import {
  type CustomerAreaErrorKey,
  fromCustomerAreaError,
} from '@web/modules/customer-area/utils/customer-area-errors.utils';

type Failure = Exclude<ActionResult<CustomerAreaErrorKey>, { ok: true }>;

const fieldErrorsOf = (error: z.ZodError) => z.flattenError(error).fieldErrors;
const idSchema = z.object({ id: z.uuid().nullish() });

const refresh = () => {
  revalidatePath('/my', 'layout');
  // Staff see it in the agenda and the queue (spec 014, CA-16).
  revalidatePath('/agenda', 'layout');
  revalidatePath('/orders', 'layout');
};

/**
 * The customer books a seat for themselves (no id, spec 014, CA-12) or changes one of their pending
 * reservations (CA-18), with THEIR session: the customer is the session's, never one sent by the
 * browser; save_reservation checks every rule of the agenda and the app's limit (RN-02, RN-03).
 */
export const saveMyReservation = async (
  input: unknown
): Promise<{ ok: true; id: string } | Failure> => {
  const customer = await getActiveCustomer();
  if (!customer) return { ok: false, error: 'forbidden' };
  const id = idSchema.safeParse(input);
  const parsed = myReservationSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: parsed.success ? undefined : fieldErrorsOf(parsed.error),
    };
  }
  const { vehicle_id, slot_start, service_ids, notes } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('save_reservation', {
    p_customer_id: customer.id,
    // null: no vehicle. The generated type marks it required as uuid.
    p_vehicle_id: vehicle_id as string,
    p_slot_start: slot_start,
    p_service_ids: service_ids,
    p_notes: notes as string,
    ...(id.data.id ? { p_id: id.data.id } : {}),
  });
  if (error) return { ok: false, error: fromCustomerAreaError(error) };
  refresh();
  return { ok: true, id: data };
};

/** The customer cancels one of their pending reservations, with an optional reason (CA-19). */
export const cancelMyReservation = async (
  input: unknown
): Promise<ActionResult<CustomerAreaErrorKey>> => {
  if (!(await getActiveCustomer())) return { ok: false, error: 'forbidden' };
  const parsed = cancelMyReservationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('cancel_reservation', {
    p_id: parsed.data.id,
    ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
  });
  if (error) return { ok: false, error: fromCustomerAreaError(error) };
  refresh();
  return { ok: true };
};
