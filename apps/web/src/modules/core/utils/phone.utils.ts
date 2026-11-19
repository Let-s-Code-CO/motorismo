/**
 * Colombian mobile numbers (spec 004, RN-03): 10 digits starting with 3. Same rule as the database
 * function private.normalize_mobile, so the form and Postgres always agree.
 */
const SEPARATORS = /[\s().-]/g;

/** "+57 300-123 4567" → "3001234567"; null when it is not a Colombian mobile. */
export const normalizeMobile = (raw: string): string | null => {
  let digits = raw.replace(SEPARATORS, '');
  if (digits.startsWith('+57')) digits = digits.slice(3);
  else if (/^57\d{10}$/.test(digits)) digits = digits.slice(2);
  return /^3\d{9}$/.test(digits) ? digits : null;
};

/** "3001234567" → "300 123 4567" for reading; anything else is returned as it is. */
export const formatMobile = (digits: string): string =>
  /^\d{10}$/.test(digits)
    ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : digits;
