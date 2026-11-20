import { z } from 'zod';

import { parsePesos } from '@web/modules/core/utils/money.utils';

/** RN-05: the highest reference price, as in the database check. */
export const MAX_PRICE = 10_000_000;

/**
 * An optional reference price (spec 007, RN-05): blank → null (not offered for that vehicle type,
 * CA-02); otherwise whole pesos from 1 to 10.000.000, typed as «25.000» or already a number (the
 * Server Action parses the form's output again).
 */
const priceField = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((raw, ctx) => {
    if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) return null;
    const value = typeof raw === 'number' ? raw : parsePesos(raw);
    if (value === null || !Number.isInteger(value) || value < 1 || value > MAX_PRICE) {
      ctx.addIssue({ code: 'custom', message: 'priceInvalid' });
      return null;
    }
    return value;
  });

const hasPrice = (data: {
  price_motorcycle?: unknown;
  price_car?: unknown;
  price_bicycle?: unknown;
}) =>
  [data.price_motorcycle, data.price_car, data.price_bicycle].some(
    (price) => price !== null && price !== undefined && price !== ''
  );

/**
 * A service of the catalog (spec 007, HU-01). Errors are message keys under
 * `services.validation`. «At least one price» is checked even when other fields fail, so the form
 * shows every problem at once (CA-03).
 */
export const serviceSchema = z
  .object({
    name: z
      .string({ error: 'nameRequired' })
      .trim()
      .min(1, { error: 'nameRequired' })
      .max(80, { error: 'nameTooLong' }),
    price_motorcycle: priceField,
    price_car: priceField,
    price_bicycle: priceField,
  })
  .refine(hasPrice, { path: ['prices'], error: 'priceRequired', when: () => true });

export type ServiceInput = z.input<typeof serviceSchema>;
export type ServiceValues = z.output<typeof serviceSchema>;
