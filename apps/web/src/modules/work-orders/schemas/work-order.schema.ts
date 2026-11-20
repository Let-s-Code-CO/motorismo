import { z } from 'zod';

import {
  MAX_LINE_PRICE,
  MAX_MINUTES,
  MIN_MINUTES,
} from '@web/modules/work-orders/constants/work-orders.constants';
import { wholeField } from '@web/modules/work-orders/schemas/fields.schema';

const shareSchema = z.object({
  employee_id: z.uuid(),
  share_pct: wholeField({ min: 1, max: 100, error: 'sharesInvalid' }),
});

/**
 * A service line (spec 008): from the catalog, or «Otro» (no service) with a description (CA-05);
 * whole pesos from $ 0 (CA-09, RN-02); an optional time (CA-28, RN-11); the employees who did it,
 * whose shares add up to 100 when there are any (CA-06, RN-03).
 */
export const lineSchema = z
  .object({
    id: z.uuid().nullish(),
    service_id: z.uuid().nullish(),
    name: z.string().trim().max(120, { error: 'nameTooLong' }),
    price: wholeField({ min: 0, max: MAX_LINE_PRICE, error: 'priceInvalid', pesos: true }),
    estimated_minutes: wholeField({
      min: MIN_MINUTES,
      max: MAX_MINUTES,
      error: 'minutesInvalid',
      required: false,
    }),
    employees: z.array(shareSchema),
  })
  .refine((line) => !!line.service_id || line.name.length > 0, {
    path: ['name'],
    error: 'otherNameRequired',
    when: () => true,
  })
  .refine(
    ({ employees }) =>
      employees.length === 0 ||
      employees.reduce((sum, { share_pct }) => sum + (share_pct ?? 0), 0) === 100,
    { path: ['employees'], error: 'sharesInvalid', when: () => true }
  );

const subtotalOf = (lines: { price?: unknown }[]) =>
  lines.reduce((sum, { price }) => sum + (typeof price === 'number' ? price : 0), 0);

/**
 * A work order as the form sends it (spec 008, HU-01). Errors are message keys under
 * `orders.validation`; every problem is reported at once (the cross-field checks run even when
 * other fields fail).
 */
export const workOrderSchema = z
  .object({
    customer_id: z.uuid({ error: 'customerRequired' }),
    vehicle_id: z.uuid({ error: 'vehicleRequired' }),
    lines: z.array(lineSchema).min(1, { error: 'linesRequired' }),
    // CA-25: blank is no discount; at most the subtotal (below).
    discount: wholeField({
      min: 0,
      max: MAX_LINE_PRICE * 100,
      error: 'discountInvalid',
      required: false,
      pesos: true,
    }).transform((value) => value ?? 0),
    notes: z
      .string()
      .nullish()
      .transform((raw) => raw?.trim() || null)
      .pipe(z.string().max(500, { error: 'notesTooLong' }).nullable()),
  })
  .refine(({ lines, discount }) => discount <= subtotalOf(lines), {
    path: ['discount'],
    error: 'discountInvalid',
    when: () => true,
  });

export type WorkOrderInput = z.input<typeof workOrderSchema>;
export type WorkOrderValues = z.output<typeof workOrderSchema>;
export type LineInput = z.input<typeof lineSchema>;
