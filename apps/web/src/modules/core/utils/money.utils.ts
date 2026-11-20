/** Whole Colombian pesos with a dot for thousands: «25.000» (spec 007, RN-05). */
const thousands = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0, useGrouping: true });

/** An amount with thousands separators, as a form shows it: «25.000». */
export const formatAmount = (value: number) => thousands.format(value);

/** A price as staff read it: «$ 25.000» (spec 007, CA-01). */
export const formatPesos = (value: number) => `$ ${formatAmount(value)}`;

/**
 * A price as staff type it: «25.000», «25000», «25 000» or «$ 25.000» → 25000. Anything else
 * (decimals, a sign, letters, blank) is not a whole number of pesos → null (CA-03).
 */
export const parsePesos = (raw: string): number | null => {
  const digits = raw.replace(/[$\s.]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
};
