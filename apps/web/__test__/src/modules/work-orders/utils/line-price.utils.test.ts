/**
 * line-price.utils — the value a service brings to an order line, by vehicle (spec 008, CA-03;
 * spec 024).
 *
 * A line copies its value when it is added, and staff can still change it; these rules decide what
 * comes pre-written:
 * - referencePrice: a motorcycle's value by its category for a service by category (CA-10), or the
 *   single one; a car's or a bicycle's own. Null when there is nothing to bring: a service «a
 *   convenir» (CA-13), a motorcycle without category for a service by category (CA-06), or a
 *   service not offered for that type.
 * - isOffered: a service is offered for a type with a value for it, by category for motorcycles, or
 *   «a convenir» for any vehicle (RN-03).
 * - needsCategory: only a service by category, on a motorcycle, needs its category first (CA-06).
 * - typedPesos: the value as the form holds it («25.000», 25000 or blank) → pesos, or null.
 */
import type { MotorcycleCategory } from '@web/modules/vehicles/constants/motorcycle-categories.constants';
import type { ServiceOption } from '@web/modules/work-orders/types/work-orders.types';
import {
  isOffered,
  needsCategory,
  referencePrice,
  typedPesos,
} from '@web/modules/work-orders/utils/line-price.utils';

type Priced = Pick<
  ServiceOption,
  'price_motorcycle' | 'motorcycle_prices' | 'price_car' | 'price_bicycle' | 'on_quote'
>;

const priced = (overrides: Partial<Priced> = {}): Priced => ({
  price_motorcycle: 25000,
  motorcycle_prices: null,
  price_car: 40000,
  price_bicycle: 10000,
  on_quote: false,
  ...overrides,
});

/** «Lavado Pro Wash» of the price list (spec 024, CA-17). */
const PRO_WASH_PRICES: Record<MotorcycleCategory, number> = {
  street: 44000,
  sbk: 46000,
  scooter: 42000,
  maxi_scooter: 46000,
  trail: 48000,
  maxi_trail: 52000,
  cruiser: 44000,
  maxi_cruiser: 48000,
};
const byCategory = (overrides: Partial<Priced> = {}) =>
  priced({
    price_motorcycle: null,
    motorcycle_prices: PRO_WASH_PRICES,
    price_car: null,
    price_bicycle: null,
    ...overrides,
  });
const onQuote = () =>
  priced({ price_motorcycle: null, price_car: null, price_bicycle: null, on_quote: true });

describe('referencePrice', () => {
  it('brings the single value of each vehicle type', () => {
    expect(referencePrice(priced(), 'motorcycle')).toBe(25000);
    expect(referencePrice(priced(), 'car')).toBe(40000);
    expect(referencePrice(priced(), 'bicycle')).toBe(10000);
  });

  it.each([
    ['street', 44000],
    ['sbk', 46000],
    ['maxi_trail', 52000],
  ] as const)('brings the value of a motorcycle’s category: %s = %d (CA-10)', (category, value) => {
    expect(referencePrice(byCategory(), 'motorcycle', category)).toBe(value);
  });

  it('brings nothing for a motorcycle without category, to ask for it first (CA-06)', () => {
    expect(referencePrice(byCategory(), 'motorcycle', null)).toBeNull();
    expect(referencePrice(byCategory(), 'motorcycle')).toBeNull();
  });

  it('ignores the category for a service with a single motorcycle value', () => {
    expect(referencePrice(priced(), 'motorcycle', 'sbk')).toBe(25000);
  });

  it('brings nothing for a service «a convenir», whatever the vehicle (CA-13)', () => {
    expect(referencePrice(onQuote(), 'motorcycle', 'sbk')).toBeNull();
    expect(referencePrice(onQuote(), 'car')).toBeNull();
  });

  it('brings nothing for a type the service is not offered for', () => {
    expect(referencePrice(byCategory(), 'car')).toBeNull();
    expect(referencePrice(priced({ price_bicycle: null }), 'bicycle')).toBeNull();
  });

  it('brings a value of 0 as 0, not as nothing (a courtesy service)', () => {
    expect(referencePrice(priced({ price_car: 0 }), 'car')).toBe(0);
  });
});

describe('isOffered', () => {
  it('offers a service by category to motorcycles only (CA-10)', () => {
    expect(isOffered(byCategory(), 'motorcycle')).toBe(true);
    expect(isOffered(byCategory(), 'car')).toBe(false);
    expect(isOffered(byCategory(), 'bicycle')).toBe(false);
  });

  it('offers a service «a convenir» to any vehicle (RN-03)', () => {
    expect(isOffered(onQuote(), 'motorcycle')).toBe(true);
    expect(isOffered(onQuote(), 'car')).toBe(true);
    expect(isOffered(onQuote(), 'bicycle')).toBe(true);
  });

  it('offers a service with a single value to the types that have one', () => {
    const carOnly = priced({ price_motorcycle: null, price_bicycle: null });
    expect(isOffered(carOnly, 'car')).toBe(true);
    expect(isOffered(carOnly, 'motorcycle')).toBe(false);
    expect(isOffered(carOnly, 'bicycle')).toBe(false);
  });
});

describe('needsCategory', () => {
  it('is true only for a service by category on a motorcycle (CA-06)', () => {
    expect(needsCategory(byCategory(), 'motorcycle')).toBe(true);
    expect(needsCategory(byCategory(), 'car')).toBe(false);
    expect(needsCategory(priced(), 'motorcycle')).toBe(false);
    expect(needsCategory(onQuote(), 'motorcycle')).toBe(false);
  });
});

describe('typedPesos', () => {
  it('reads a value typed with thousands separators, or already a number', () => {
    expect(typedPesos('25.000')).toBe(25000);
    expect(typedPesos(25000)).toBe(25000);
  });

  it('is null while blank', () => {
    expect(typedPesos('')).toBeNull();
    expect(typedPesos('   ')).toBeNull();
    expect(typedPesos(undefined)).toBeNull();
  });
});
