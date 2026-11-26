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
 * - Spec 024, CA-07 / CA-08: the motorcycle value is single or one per category, all eight (each
 *   missing one reported next to its field); never both.
 * - Spec 024, CA-12: «A convenir» has no values nor time: whatever was typed is dropped.
 * - Spec 024, CA-19: an optional description, up to 300 characters.
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
      motorcycle_prices: null,
      price_car: 40000,
      price_bicycle: null,
      estimated_minutes: null,
      on_quote: false,
      description: null,
      includes: [],
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

  describe('by category (spec 024)', () => {
    const EIGHT = {
      street: '44.000',
      sbk: '46.000',
      scooter: '42.000',
      maxi_scooter: '46.000',
      trail: '48.000',
      maxi_trail: '52.000',
      cruiser: '44.000',
      maxi_cruiser: '48.000',
    };

    it('keeps a value for each of the eight categories, and no single value (CA-07)', () => {
      const values = serviceSchema.parse(
        input({ motorcycle_mode: 'category', motorcycle_prices: EIGHT, price_motorcycle: '25.000' })
      );

      expect(values.motorcycle_prices).toEqual({
        street: 44000,
        sbk: 46000,
        scooter: 42000,
        maxi_scooter: 46000,
        trail: 48000,
        maxi_trail: 52000,
        cruiser: 44000,
        maxi_cruiser: 48000,
      });
      expect(values.price_motorcycle).toBeNull();
    });

    it('reports each missing category next to its field: all eight or none (CA-08)', () => {
      expect(
        issuesOf(
          input({
            motorcycle_mode: 'category',
            motorcycle_prices: { ...EIGHT, trail: '', maxi_cruiser: 'mucho' },
          })
        )
      ).toEqual({
        'motorcycle_prices.trail': 'categoryPriceRequired',
        'motorcycle_prices.maxi_cruiser': 'priceInvalid',
      });
    });

    it('counts the eight values as the price a service needs (CA-07)', () => {
      expect(
        serviceSchema.safeParse(
          input({ price_motorcycle: '', motorcycle_mode: 'category', motorcycle_prices: EIGHT })
        ).success
      ).toBe(true);
    });

    it('accepts its own output again, as the Server Action parses what the form sends (it carries the values, not the choice)', () => {
      const once = serviceSchema.parse(
        input({ price_motorcycle: '', motorcycle_mode: 'category', motorcycle_prices: EIGHT })
      );

      expect(serviceSchema.parse(once)).toEqual(once);
    });

    it('accepts its own output of a service «a convenir» again', () => {
      const once = serviceSchema.parse(
        input({ name: 'PPF', price_motorcycle: '', on_quote: true })
      );

      expect(serviceSchema.parse(once)).toEqual(once);
    });

    it('drops the eight values when the motorcycle value is single (CA-07)', () => {
      expect(
        serviceSchema.parse(input({ motorcycle_mode: 'single', motorcycle_prices: EIGHT }))
          .motorcycle_prices
      ).toBeNull();
    });
  });

  describe('«a convenir» (spec 024, CA-12)', () => {
    it('has no values nor time, whatever was typed, and needs no price', () => {
      const values = serviceSchema.parse(
        input({ name: 'PPF', on_quote: true, price_car: '90.000', estimated_minutes: '60' })
      );

      expect(values).toMatchObject({
        on_quote: true,
        price_motorcycle: null,
        motorcycle_prices: null,
        price_car: null,
        price_bicycle: null,
        estimated_minutes: null,
      });
    });
  });

  describe('description (spec 024, CA-19)', () => {
    it('keeps it trimmed, and a blank one as null', () => {
      expect(serviceSchema.parse(input({ description: '  Incluye sellador. ' })).description).toBe(
        'Incluye sellador.'
      );
      expect(serviceSchema.parse(input({ description: ' ' })).description).toBeNull();
    });

    it('refuses more than 300 characters', () => {
      expect(issuesOf(input({ description: 'a'.repeat(301) }))).toEqual({
        description: 'descriptionTooLong',
      });
    });
  });

  describe('what it includes (spec 024, CA-20)', () => {
    const PRO_WASH = '7a1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

    it('keeps the services it includes, none by default', () => {
      expect(serviceSchema.parse(input({ includes: [PRO_WASH] })).includes).toEqual([PRO_WASH]);
      expect(serviceSchema.parse(input()).includes).toEqual([]);
    });

    it('includes nothing when it is «a convenir»', () => {
      expect(
        serviceSchema.parse(input({ name: 'PPF', on_quote: true, includes: [PRO_WASH] })).includes
      ).toEqual([]);
    });
  });
});
