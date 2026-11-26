import { z } from 'zod';

import { isAgendaDate } from '@web/modules/reservations/utils/agenda-date.utils';

/** Errors are message keys under `reservations.validation`. */

const QUOTED_MINUTES = { min: 5, max: 1440 };

/** A time typed as text or already a number → whole minutes, or null when blank or not whole. */
const minutesOfText = (raw: string | number | null | undefined) => {
  const text = typeof raw === 'number' ? String(raw) : (raw ?? '').trim();
  return /^\d+$/.test(text) ? Number(text) : null;
};

/**
 * RF-01: a customer and a slot; vehicle, services and notes are optional (CA-01, CA-04). Spec 024,
 * CA-14: `service_minutes` holds the time of each service «a convenir» ticked, by its id (the form
 * shows a field only for those); a ticked one needs 5 to 1.440 minutes, one no longer ticked is
 * dropped. The database requires it for every service «a convenir» again.
 */
export const reservationSchema = z
  .object({
    customer_id: z.uuid({ error: 'customerRequired' }),
    vehicle_id: z
      .uuid()
      .nullish()
      .transform((value) => value ?? null),
    slot_start: z.iso.datetime({ offset: true, error: 'slotRequired' }),
    service_ids: z
      .array(z.uuid())
      .optional()
      .transform((value) => value ?? []),
    service_minutes: z
      .record(z.string(), z.union([z.string(), z.number(), z.null()]))
      .optional()
      .transform((value) => value ?? {}),
    notes: z
      .string()
      .nullish()
      .transform((value) => value?.trim() || null)
      .refine((value) => !value || value.length <= 500, { error: 'notesTooLong' }),
  })
  .superRefine(({ service_ids = [], service_minutes = {} }, ctx) => {
    Object.entries(service_minutes).forEach(([id, raw]) => {
      if (!service_ids.includes(id)) return;
      const blank = raw === null || String(raw).trim() === '';
      const minutes = minutesOfText(raw);
      if (minutes !== null && minutes >= QUOTED_MINUTES.min && minutes <= QUOTED_MINUTES.max)
        return;
      ctx.addIssue({
        code: 'custom',
        path: ['service_minutes', id],
        message: blank ? 'quotedMinutesRequired' : 'quotedMinutesRange',
      });
    });
  })
  .transform(({ service_minutes, ...reservation }) => ({
    ...reservation,
    service_minutes: Object.fromEntries(
      Object.entries(service_minutes)
        .filter(([id]) => reservation.service_ids.includes(id))
        .map(([id, raw]) => [id, minutesOfText(raw)!])
    ),
  }));

export type ReservationInput = z.input<typeof reservationSchema>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
};

const agendaDaySchema = z.object({
  is_open: z.boolean(),
  opens_at: z.string(),
  closes_at: z.string(),
});

/**
 * A week of «Horario» (HU-05): seven days, Monday first. An open day closes after it opens and
 * holds at least one full slot of `slotMinutes` (CA-30); a closed day keeps whatever hours.
 */
export const agendaWeekSchema = (slotMinutes: number) =>
  z
    .object({
      week_start: z.string().refine(isAgendaDate),
      enabled: z.boolean(),
      days: z.array(agendaDaySchema).length(7),
    })
    .superRefine(({ days }, ctx) => {
      days.forEach((day, index) => {
        if (!day.is_open) return;
        const valid =
          TIME.test(day.opens_at) &&
          TIME.test(day.closes_at) &&
          minutesOf(day.closes_at) - minutesOf(day.opens_at) >= slotMinutes;
        if (!valid)
          ctx.addIssue({
            code: 'custom',
            path: ['days', index, 'closes_at'],
            message: 'dayInvalid',
          });
      });
    });

export type AgendaWeekInput = z.input<ReturnType<typeof agendaWeekSchema>>;

/** A whole number typed as text or already a number, from `min` to `max` (and a multiple of `step`). */
const wholeInRange = (min: number, max: number, error: string, step = 1) =>
  z.union([z.number(), z.string()]).transform((raw, ctx) => {
    const text = typeof raw === 'number' ? String(raw) : raw.trim();
    const value = /^\d+$/.test(text) ? Number(text) : NaN;
    if (!Number.isInteger(value) || value < min || value > max || value % step !== 0) {
      ctx.addIssue({ code: 'custom', message: error });
      return z.NEVER;
    }
    return value;
  });

/** CA-29: slots of 15 to 240 minutes in steps of 15, 1 to 20 seats, 0 to 60 of tolerance. */
export const agendaSettingsSchema = z.object({
  slot_minutes: wholeInRange(15, 240, 'slotMinutesRange', 15),
  seats: wholeInRange(1, 20, 'seatsRange'),
  tolerance_minutes: wholeInRange(0, 60, 'toleranceRange'),
});

export type AgendaSettingsInput = z.input<typeof agendaSettingsSchema>;
