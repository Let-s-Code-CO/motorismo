/**
 * phone.utils — Colombian mobile numbers (spec 004, RN-03).
 *
 * The business contacts customers by mobile (and, later, WhatsApp), so a phone is only accepted if
 * it is a Colombian mobile: 10 digits starting with 3. People type it in many ways (+57, spaces,
 * hyphens, parentheses), so those are accepted and the number is stored as the bare 10 digits —
 * the same rule the database applies (private.normalize_mobile), so both layers agree.
 */
import { formatMobile, normalizeMobile } from '@web/modules/core/utils/phone.utils';

describe('normalizeMobile', () => {
  it.each([
    ['3001234567', '3001234567'],
    ['300 123 4567', '3001234567'],
    ['300-123-4567', '3001234567'],
    ['(300) 123.45.67', '3001234567'],
    ['+57 300 123 4567', '3001234567'],
    ['+573001234567', '3001234567'],
    ['57 3001234567', '3001234567'],
    ['  3001234567  ', '3001234567'],
  ])('accepts %j as %s', (raw, expected) => {
    expect(normalizeMobile(raw)).toBe(expected);
  });

  it.each([
    ['9 digits', '300123456'],
    ['11 digits without the 57 prefix', '30012345678'],
    ['a landline (does not start with 3)', '6012345678'],
    ['letters', '300abc4567'],
    ['another country prefix', '+1 300 123 4567'],
    ['an empty value', ''],
  ])('rejects %s', (_case, raw) => {
    expect(normalizeMobile(raw)).toBeNull();
  });
});

describe('formatMobile', () => {
  it('groups the 10 digits as 3-3-4 for reading', () => {
    expect(formatMobile('3001234567')).toBe('300 123 4567');
  });

  it('leaves anything that is not 10 digits as it is', () => {
    expect(formatMobile('12345')).toBe('12345');
  });
});
