/**
 * serviceSchema — the service form, checked before anything is sent (spec 007, HU-01).
 *
 * Guards:
 * - CA-03: a name is required (up to 80 characters); every price is optional, but at least one is
 *   needed; a price is a whole number of pesos from 1 to 10.000.000 (RN-05). Every problem is
 *   reported at once, next to its field.
 * - CA-01: a typed «25.000» is sent as 25000; a blank price is sent as null (not offered, CA-02).
 * - The Server Action parses the form's output again: numbers are accepted as they are.
 * - Spec 008, CA-26 / RN-11: an optional estimated time, whole minutes from 5 to 1.440.
 */
import { serviceSchema } from '@web/modules/services/schemas/service.schema';

const input = (overrides: Record<string, unknown> = {}) => ({
  name: 'Lavado sencillo',
  price_motorcycle: '25.000',
  price_car: '',
  price_bicycle: '',
  estimated_minutes: '',
  ...overrides,
});

const issuesOf = (value: unknown) => {
  const result = serviceSchema.safeParse(value);
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((issue) => [issue.path.join('.'), issue.message]));
};

describe('serviceSchema', () => {
  it('turns typed prices into whole pesos, and a blank one into null (CA-01, CA-02)', () => {
    expect(serviceSchema.parse(input({ price_car: '40000', price_bicycle: ' ' }))).toEqual({
      name: 'Lavado sencillo',
      price_motorcycle: 25000,
      price_car: 40000,
      price_bicycle: null,
      estimated_minutes: null,
    });
  });

  it("accepts the form's own output again (numbers and null), as the Server Action does", () => {
    expect(
      serviceSchema.parse({
        name: 'Micropulido',
        price_motorcycle: 120000,
        price_car: null,
        price_bicycle: null,
      })
    ).toMatchObject({ price_motorcycle: 120000, price_car: null });
  });

  it('requires a name, and at least one price (CA-03)', () => {
    expect(issuesOf(input({ name: '  ', price_motorcycle: '' }))).toEqual({
      name: 'nameRequired',
      prices: 'priceRequired',
    });
  });

  it('refuses a name longer than 80 characters (CA-03)', () => {
    expect(issuesOf(input({ name: 'x'.repeat(81) }))).toEqual({ name: 'nameTooLong' });
  });

  it.each([
    ['0', 'zero'],
    ['10.000.001', 'more than $ 10.000.000'],
    ['12,5', 'decimals'],
    ['-5', 'a negative amount'],
    ['mucho', 'text'],
  ])('refuses «%s» as a price (%s) (CA-03, RN-05)', (typed) => {
    expect(issuesOf(input({ price_car: typed }))).toEqual({ price_car: 'priceInvalid' });
  });

  it('accepts the limits: $ 1 and $ 10.000.000 (RN-05)', () => {
    expect(issuesOf(input({ price_motorcycle: '1', price_car: '10.000.000' }))).toEqual({});
  });

  it('keeps an estimated time in whole minutes, optional (spec 008, CA-26)', () => {
    expect(serviceSchema.parse(input({ estimated_minutes: '45' })).estimated_minutes).toBe(45);
    expect(serviceSchema.parse(input({ estimated_minutes: '' })).estimated_minutes).toBeNull();
  });

  it.each(['4', '1441', '1.5', 'media hora'])(
    'refuses «%s» as an estimated time (spec 008, RN-11)',
    (minutes) => {
      expect(issuesOf(input({ estimated_minutes: minutes }))).toEqual({
        estimated_minutes: 'minutesInvalid',
      });
    }
  );
});
