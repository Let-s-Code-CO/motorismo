'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { getAgendaSettings } from '@web/modules/reservations/api/reservations.server';
import { AGENDA_PATH } from '@web/modules/reservations/constants/reservations.constants';
import {
  agendaSettingsSchema,
  agendaWeekSchema,
  reservationSchema,
} from '@web/modules/reservations/schemas/reservations.schema';
import {
  type ReservationsErrorKey,
  dayOfError,
  fromReservationError,
} from '@web/modules/reservations/utils/reservations-errors.utils';

type Failure = Exclude<ActionResult<ReservationsErrorKey>, { ok: true }> & { day?: string };

const fieldErrorsOf = (error: z.ZodError) => z.flattenError(error).fieldErrors;

const refresh = () => {
  revalidatePath(AGENDA_PATH, 'layout');
  revalidatePath('/orders', 'layout');
};

const idSchema = z.object({ id: z.uuid().nullish() });

/**
 * Staff book a seat (no id, spec 012, CA-05) or change a pending reservation (CA-20), with their OWN
 * session: save_reservation checks the slot, the seats and every rule again (RN-02). Returns the
 * reservation's id.
 */
export const saveReservation = async (
  input: unknown
): Promise<{ ok: true; id: string } | Failure> => {
  if (!(await getActiveStaff())) return { ok: false, error: 'forbidden' };

  const id = idSchema.safeParse(input);
  const parsed = reservationSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: parsed.success ? undefined : fieldErrorsOf(parsed.error),
    };
  }
  const { customer_id, vehicle_id, slot_start, service_ids, notes } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('save_reservation', {
    p_customer_id: customer_id,
    // null: no vehicle (CA-01). The generated type marks it required as uuid.
    p_vehicle_id: vehicle_id as string,
    p_slot_start: slot_start,
    p_service_ids: service_ids,
    ...(notes ? { p_notes: notes } : {}),
    ...(id.data.id ? { p_id: id.data.id } : {}),
  });
  if (error) return { ok: false, error: fromReservationError(error) };

  refresh();
  return { ok: true, id: data };
};

const reasonSchema = z.object({
  id: z.uuid(),
  reason: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null)
    .refine((value) => !value || value.length <= 200, { error: 'reasonTooLong' }),
});

/** Staff cancel a pending reservation, with an optional reason (CA-21). */
export const cancelReservation = async (
  input: unknown
): Promise<ActionResult<ReservationsErrorKey>> => {
  if (!(await getActiveStaff())) return { ok: false, error: 'forbidden' };
  const parsed = reasonSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'invalidInput', fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('cancel_reservation', {
    p_id: parsed.data.id,
    ...(parsed.data.reason ? { p_reason: parsed.data.reason } : {}),
  });
  if (error) return { ok: false, error: fromReservationError(error) };
  refresh();
  return { ok: true };
};

/** Staff record that the customer did not come, once their tolerance has passed (CA-22). */
export const markNoShow = async (input: unknown): Promise<ActionResult<ReservationsErrorKey>> => {
  if (!(await getActiveStaff())) return { ok: false, error: 'forbidden' };
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('mark_reservation_no_show', { p_id: parsed.data.id });
  if (error) return { ok: false, error: fromReservationError(error) };
  refresh();
  return { ok: true };
};

const toleranceSchema = z.object({
  id: z.uuid(),
  minutes: z
    .number()
    .int()
    .min(0, { error: 'toleranceRange' })
    .max(60, { error: 'toleranceRange' })
    .nullable(),
});

/** The admin gives a pending reservation its own tolerance, or back to the general one (CA-24). */
export const setReservationTolerance = async (
  input: unknown
): Promise<ActionResult<ReservationsErrorKey>> => {
  if (!(await getActiveAdmin())) return { ok: false, error: 'adminOnly' };
  const parsed = toleranceSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'invalidInput', fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_reservation_tolerance', {
    p_id: parsed.data.id,
    // null: back to the general tolerance (RN-11). The generated type marks it required.
    p_minutes: parsed.data.minutes as number,
  });
  if (error) return { ok: false, error: fromReservationError(error) };
  refresh();
  return { ok: true };
};

/**
 * Staff give a customer on their way 5 more minutes to keep their turn (spec 012, CA-34), up to 60:
 * extend_reservation_tolerance checks it is still pending and within its tolerance. Returns the new
 * tolerance.
 */
export const extendReservationTolerance = async (
  input: unknown
): Promise<{ ok: true; minutes: number } | Failure> => {
  if (!(await getActiveStaff())) return { ok: false, error: 'forbidden' };
  const parsed = z.object({ id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('extend_reservation_tolerance', {
    p_id: parsed.data.id,
  });
  if (error) return { ok: false, error: fromReservationError(error) };
  refresh();
  return { ok: true, minutes: data };
};

/**
 * The admin saves a week's seven days and whether it is enabled (CA-26 to CA-28). A day that
 * cannot hold a full slot comes back named (CA-30).
 */
export const saveAgendaWeek = async (
  input: unknown
): Promise<ActionResult<ReservationsErrorKey> & { day?: string }> => {
  if (!(await getActiveAdmin())) return { ok: false, error: 'adminOnly' };
  const { slot_minutes } = await getAgendaSettings();
  const parsed = agendaWeekSchema(slot_minutes).safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'invalidInput', fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_agenda_week', {
    p_week_start: parsed.data.week_start,
    p_days: parsed.data.days,
    p_enabled: parsed.data.enabled,
  });
  if (error) {
    const day = dayOfError(error);
    return { ok: false, error: fromReservationError(error), ...(day ? { day } : {}) };
  }
  refresh();
  return { ok: true };
};

/** The admin sets the slot length, the seats and the general tolerance (CA-29). */
export const saveAgendaSettings = async (
  input: unknown
): Promise<ActionResult<ReservationsErrorKey>> => {
  if (!(await getActiveAdmin())) return { ok: false, error: 'adminOnly' };
  const parsed = agendaSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: 'invalidInput', fieldErrors: fieldErrorsOf(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('save_agenda_settings', {
    p_slot_minutes: parsed.data.slot_minutes,
    p_seats: parsed.data.seats,
    p_tolerance_minutes: parsed.data.tolerance_minutes,
  });
  if (error) return { ok: false, error: fromReservationError(error) };
  refresh();
  return { ok: true };
};
