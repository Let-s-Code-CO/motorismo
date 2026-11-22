'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { paymentListSchema } from '@web/modules/work-orders/schemas/payments.schema';
import { workOrderSchema } from '@web/modules/work-orders/schemas/work-order.schema';
import { toLinesPayload } from '@web/modules/work-orders/utils/lines-payload.utils';
import {
  type WorkOrdersErrorKey,
  fromWorkOrderError,
} from '@web/modules/work-orders/utils/work-orders-errors.utils';

const ORDERS_PATH = '/orders';

const fieldErrorsOf = (error: z.ZodError) => z.flattenError(error).fieldErrors;

const idSchema = z.object({ id: z.uuid().nullish(), reservation_id: z.uuid().nullish() });

/**
 * Staff open an order (no id, CA-07) or edit an open one (CA-08), with their OWN session:
 * save_work_order checks every rule again (RN-05). With `reservation_id` (spec 012, CA-13), the
 * reservation the customer arrived with becomes this order. Returns the order's id, to open it.
 */
export const saveWorkOrder = async (
  input: unknown
): Promise<{ ok: true; id: string } | Exclude<ActionResult<WorkOrdersErrorKey>, { ok: true }>> => {
  const staff = await getActiveStaff();
  if (!staff) return { ok: false, error: 'forbidden' };

  const id = idSchema.safeParse(input);
  const parsed = workOrderSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: parsed.success ? undefined : fieldErrorsOf(parsed.error),
    };
  }
  const { customer_id, vehicle_id, lines, discount, notes } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('save_work_order', {
    p_customer_id: customer_id,
    p_vehicle_id: vehicle_id,
    p_lines: toLinesPayload(lines),
    p_discount: discount,
    ...(notes ? { p_notes: notes } : {}),
    ...(id.data.id ? { p_id: id.data.id } : {}),
    // Spec 012, CA-13: the reservation the customer arrived with becomes this order.
    ...(id.data.reservation_id ? { p_reservation_id: id.data.reservation_id } : {}),
  });
  if (error) return { ok: false, error: fromWorkOrderError(error) };

  revalidatePath(ORDERS_PATH, 'layout');
  if (id.data.reservation_id) revalidatePath('/agenda', 'layout');
  return { ok: true, id: data };
};

const closeSchema = paymentListSchema.extend({ id: z.uuid() });

/**
 * Staff close an open order with its payments (CA-11): close_work_order checks every line has
 * employees and the payments add up to the total (CA-12, CA-13).
 */
export const closeWorkOrder = async (input: unknown): Promise<ActionResult<WorkOrdersErrorKey>> => {
  const staff = await getActiveStaff();
  if (!staff) return { ok: false, error: 'forbidden' };

  const parsed = closeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('close_work_order', {
    p_id: parsed.data.id,
    p_payments: parsed.data.payments,
  });
  if (error) return { ok: false, error: fromWorkOrderError(error) };

  revalidatePath(ORDERS_PATH, 'layout');
  return { ok: true };
};

const voidSchema = z.object({ id: z.uuid(), reason: z.string().trim().min(1) });

/**
 * Staff void an order with a reason (CA-21): void_work_order lets staff void an open one and only an
 * admin a closed one (CA-23, RN-05). The order is kept, marked (RN-06).
 */
export const voidWorkOrder = async (input: unknown): Promise<ActionResult<WorkOrdersErrorKey>> => {
  const staff = await getActiveStaff();
  if (!staff) return { ok: false, error: 'forbidden' };

  const parsed = voidSchema.safeParse(input);
  if (!parsed.success) {
    const reasonMissing = parsed.error.issues.some(({ path }) => path[0] === 'reason');
    return { ok: false, error: reasonMissing ? 'reasonRequired' : 'invalidInput' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('void_work_order', {
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
  });
  if (error) return { ok: false, error: fromWorkOrderError(error) };

  revalidatePath(ORDERS_PATH, 'layout');
  return { ok: true };
};

const correctionSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(1, { error: 'reasonRequired' }),
});

/**
 * An admin corrects a closed order with a reason (CA-22, RN-05): its lines, discount and payments
 * are replaced with the same rules as saving and closing, and the order says who corrected it,
 * when and why.
 */
export const correctWorkOrder = async (
  input: unknown
): Promise<ActionResult<WorkOrdersErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const head = correctionSchema.safeParse(input);
  const order = workOrderSchema.safeParse(input);
  const payments = paymentListSchema.safeParse(input);
  if (!head.success || !order.success || !payments.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: order.success ? undefined : fieldErrorsOf(order.error),
    };
  }
  const { lines, discount, notes } = order.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('correct_work_order', {
    p_id: head.data.id,
    p_lines: toLinesPayload(lines),
    p_payments: payments.data.payments,
    p_reason: head.data.reason,
    p_discount: discount,
    ...(notes ? { p_notes: notes } : {}),
  });
  if (error) return { ok: false, error: fromWorkOrderError(error) };

  revalidatePath(ORDERS_PATH, 'layout');
  return { ok: true };
};

const startSchema = z.object({ id: z.uuid() });

/**
 * Staff start an order in the queue: it moves to «En proceso» (spec 008, CA-33). The database
 * refuses an order already started or no longer open (CA-36).
 */
export const startWorkOrder = async (input: unknown): Promise<ActionResult<WorkOrdersErrorKey>> => {
  const staff = await getActiveStaff();
  if (!staff) return { ok: false, error: 'forbidden' };

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('start_work_order', { p_id: parsed.data.id });
  if (error) return { ok: false, error: fromWorkOrderError(error) };

  revalidatePath(ORDERS_PATH, 'layout');
  return { ok: true };
};
