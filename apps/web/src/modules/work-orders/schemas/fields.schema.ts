import { z } from 'zod';

import { parsePesos } from '@web/modules/core/utils/money.utils';

/**
 * A whole number typed as text or already a number; blank → null. Pesos may carry thousands
 * separators («25.000»); plain counts (minutes, percentages) are digits only, so «1.5» is not 15.
 */
const toWhole = (raw: unknown, pesos: boolean): number | null | 'invalid' => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : 'invalid';
  if (typeof raw !== 'string' || !raw.trim()) return null;
  if (pesos) return parsePesos(raw) ?? 'invalid';
  return /^\d+$/.test(raw.trim()) ? Number(raw.trim()) : 'invalid';
};

/**
 * A whole amount from `min` to `max`. `required`: blank is an error too. Errors are message keys
 * under `orders.validation`.
 */
export const wholeField = ({
  min,
  max,
  error,
  required = true,
  pesos = false,
}: {
  min: number;
  max: number;
  error: string;
  required?: boolean;
  /** Pesos accept thousands separators; other counts are digits only. */
  pesos?: boolean;
}) =>
  z
    .union([z.number(), z.string()])
    .nullish()
    .transform((raw, ctx) => {
      const value = toWhole(raw, pesos);
      if (value === null && !required) return null;
      if (value === null || value === 'invalid' || value < min || value > max) {
        ctx.addIssue({ code: 'custom', message: error });
        return null;
      }
      return value;
    });
