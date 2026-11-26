import { z } from 'zod';

import { parsePesos } from '@web/modules/core/utils/money.utils';
import {
  MOTORCYCLE_CATEGORIES,
  type MotorcycleCategory,
} from '@web/modules/vehicles/constants/motorcycle-categories.constants';

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

/**
 * Spec 008, CA-26 / RN-11: an optional estimated time, whole minutes from 5 to 1.440 (digits only:
 * «1.5» is not 15).
 */
const minutesField = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((raw, ctx) => {
    if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) return null;
    const text = String(raw).trim();
    const value = /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isInteger(value) || value < 5 || value > 1440) {
      ctx.addIssue({ code: 'custom', message: 'minutesInvalid' });
      return null;
    }
    return value;
  });

/** The raw value of a price field: what the form holds or a number already parsed. */
type RawPrice = string | number | null | undefined;
const isBlank = (raw: RawPrice) =>
  raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim());

/** A category's value in whole pesos from 1 to 10.000.000 (RN-05), or null when it is not one. */
const categoryPrice = (raw: RawPrice) => {
  if (isBlank(raw)) return null;
  const value = typeof raw === 'number' ? raw : parsePesos(String(raw));
  return value !== null && Number.isInteger(value) && value >= 1 && value <= MAX_PRICE
    ? value
    : null;
};

/** Spec 024, CA-19: an optional description, up to 300 characters; blank is none. */
const descriptionField = z
  .string()
  .nullish()
  .transform((raw) => raw?.trim() || null)
  .refine((value) => value === null || value.length <= 300, { error: 'descriptionTooLong' });

/**
 * A service of the catalog (spec 007, HU-01; spec 024). Errors are message keys under
 * `services.validation`; every problem is reported at once, next to its field (CA-03).
 * - Spec 024, CA-07 / CA-08: the motorcycle value is single or, with `motorcycle_mode: 'category'`,
 *   one per category, all eight: each missing one is reported at `motorcycle_prices.<category>`.
 * - Spec 024, CA-12: «a convenir» (`on_quote`) has no values nor time: what was typed is dropped.
 * - At least one price, unless it is «a convenir».
 */
/** Single or by category: as chosen, or else by the values it carries. */
const modeOf = (data: { motorcycle_mode?: 'single' | 'category'; motorcycle_prices?: unknown }) =>
  data.motorcycle_mode ?? (data.motorcycle_prices ? 'category' : 'single');

export const serviceSchema = z
  .object({
    name: z
      .string({ error: 'nameRequired' })
      .trim()
      .min(1, { error: 'nameRequired' })
      .max(80, { error: 'nameTooLong' }),
    price_motorcycle: priceField,
    // Without it (the form's own output, parsed again by the Server Action), the values say it.
    motorcycle_mode: z.enum(['single', 'category']).optional(),
    motorcycle_prices: z.record(z.string(), z.union([z.number(), z.string()]).nullish()).nullish(),
    price_car: priceField,
    price_bicycle: priceField,
    estimated_minutes: minutesField,
    on_quote: z.boolean().default(false),
    description: descriptionField,
    // Spec 024, CA-20: the services it includes (the database refuses a loop).
    includes: z
      .array(z.uuid())
      .optional()
      .transform((value) => value ?? []),
  })
  // Checked even when other fields fail, so the form shows every problem at once (CA-03).
  .superRefine(
    (data, ctx) => {
      const byCategory = !data.on_quote && modeOf(data) === 'category';
      if (byCategory) {
        for (const category of MOTORCYCLE_CATEGORIES) {
          const raw = data.motorcycle_prices?.[category] as RawPrice;
          const path = ['motorcycle_prices', category];
          if (isBlank(raw)) {
            ctx.addIssue({ code: 'custom', path, message: 'categoryPriceRequired' });
          } else if (categoryPrice(raw) === null) {
            ctx.addIssue({ code: 'custom', path, message: 'priceInvalid' });
          }
        }
      }
      const single = [data.price_motorcycle, data.price_car, data.price_bicycle];
      if (!data.on_quote && !byCategory && single.every((price) => isBlank(price as RawPrice))) {
        ctx.addIssue({ code: 'custom', path: ['prices'], message: 'priceRequired' });
      }
    },
    { when: () => true }
  )
  .transform((data) => {
    const byCategory = !data.on_quote && modeOf(data) === 'category';
    const motorcyclePrices = byCategory
      ? (Object.fromEntries(
          MOTORCYCLE_CATEGORIES.map((category) => [
            category,
            categoryPrice(data.motorcycle_prices?.[category] as RawPrice),
          ])
        ) as Record<MotorcycleCategory, number>)
      : null;
    return {
      name: data.name,
      price_motorcycle: data.on_quote || byCategory ? null : data.price_motorcycle,
      motorcycle_prices: motorcyclePrices,
      price_car: data.on_quote ? null : data.price_car,
      price_bicycle: data.on_quote ? null : data.price_bicycle,
      estimated_minutes: data.on_quote ? null : data.estimated_minutes,
      on_quote: data.on_quote,
      description: data.description,
      includes: data.on_quote ? [] : data.includes,
    };
  });

export type ServiceInput = z.input<typeof serviceSchema>;
export type ServiceValues = z.output<typeof serviceSchema>;
