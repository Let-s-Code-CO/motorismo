/**
 * money.utils — prices in Colombian pesos, as staff read and type them (spec 007, RN-05).
 *
 * Guards:
 * - CA-01: a price shows as «$ 25.000» (dot for thousands, no decimals).
 * - CA-03: staff may type «25.000», «25000» or «25 000»; anything that is not a whole number of
 *   pesos (decimals, a sign, letters) is not a price.
 */
import { formatPesos, parsePesos } from '@web/modules/core/utils/money.utils';

describe('formatPesos', () => {
  it.each([
    [25000, '$ 25.000'],
    [1, '$ 1'],
    [10000000, '$ 10.000.000'],
  ])('shows %i as «%s» (CA-01)', (value, shown) => {
    expect(formatPesos(value)).toBe(shown);
  });
});

describe('parsePesos', () => {
  it.each([
    ['25.000', 25000],
    ['25000', 25000],
    [' 25 000 ', 25000],
    ['$ 40.000', 40000],
  ])('reads «%s» as %i', (typed, value) => {
    expect(parsePesos(typed)).toBe(value);
  });

  it.each(['25,5', '-1', 'abc', '', '   '])('does not read «%s» as a price (CA-03)', (typed) => {
    expect(parsePesos(typed)).toBeNull();
  });
});
