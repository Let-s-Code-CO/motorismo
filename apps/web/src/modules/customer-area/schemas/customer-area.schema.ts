import { z } from 'zod';

/** Errors are message keys under `customerArea.validation`. */

/** A reservation the customer makes or changes (spec 014, CA-12, CA-18): their vehicle or none. */
export const myReservationSchema = z.object({
  vehicle_id: z
    .uuid()
    .nullish()
    .transform((value) => value ?? null),
  slot_start: z.iso.datetime({ offset: true, error: 'slotRequired' }),
  service_ids: z
    .array(z.uuid())
    .optional()
    .transform((value) => value ?? []),
  notes: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null)
    .refine((value) => !value || value.length <= 500, { error: 'notesTooLong' }),
});

export type MyReservationInput = z.input<typeof myReservationSchema>;

/** Cancelling: the reason is optional (CA-19). */
export const cancelMyReservationSchema = z.object({
  id: z.uuid(),
  reason: z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null)
    .refine((value) => !value || value.length <= 200, { error: 'reasonTooLong' }),
});
