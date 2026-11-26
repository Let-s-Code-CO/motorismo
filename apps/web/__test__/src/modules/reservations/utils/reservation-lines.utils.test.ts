/**
 * reservation-lines.utils — what a reservation brings to the order opened when the customer arrives
 * (spec 012, CA-12, RN-07).
 *
 * The services of a reservation are an intention: on arrival, each one is offered as a line with
 * the catalog's value and time of that moment for the vehicle's type, in the order they were
 * booked. A service no longer active, or not offered for that type, is not copied: it is named so
 * staff can tell the customer. Spec 024, RN-06: nor one that no longer goes with the services brought
 * before it (the admin changed what a service includes after the booking).
 */
import { linesFromReservation } from '@web/modules/reservations/utils/reservation-lines.utils';
import type { ServiceOption } from '@web/modules/work-orders/types/work-orders.types';

const service = (
  id: string,
  name: string,
  overrides: Partial<ServiceOption> = {}
): ServiceOption => ({
  id,
  name,
  price_motorcycle: 25000,
  motorcycle_prices: null,
  price_car: 40000,
  price_bicycle: null,
  estimated_minutes: 30,
  on_quote: false,
  includes: [],
  ...overrides,
});

const CATALOG = [
  service('wash', 'Lavado detallado', { price_motorcycle: 30000 }),
  service('chain', 'Limpieza de cadena', { price_car: null }),
];

describe('linesFromReservation', () => {
  it('offers each booked service as it is in the catalog now, in the booked order (CA-12, RN-07)', () => {
    const { services, skipped } = linesFromReservation(
      { service_ids: ['chain', 'wash'], services: ['Limpieza de cadena', 'Lavado detallado'] },
      CATALOG,
      'motorcycle'
    );

    expect(services.map(({ id }) => id)).toEqual(['chain', 'wash']);
    expect(services[1]!.price_motorcycle).toBe(30000);
    expect(skipped).toEqual([]);
  });

  it('names a service not offered for the vehicle type, and does not copy it (RN-07)', () => {
    const { services, skipped } = linesFromReservation(
      { service_ids: ['chain', 'wash'], services: ['Limpieza de cadena', 'Lavado detallado'] },
      CATALOG,
      'car'
    );

    expect(services.map(({ id }) => id)).toEqual(['wash']);
    expect(skipped).toEqual(['Limpieza de cadena']);
  });

  it('names a service that is no longer active (not in the catalog), and does not copy it (RN-07)', () => {
    const { services, skipped } = linesFromReservation(
      { service_ids: ['old', 'wash'], services: ['Polichado', 'Lavado detallado'] },
      CATALOG,
      'motorcycle'
    );

    expect(services.map(({ id }) => id)).toEqual(['wash']);
    expect(skipped).toEqual(['Polichado']);
  });

  it('brings nothing from a reservation without services', () => {
    expect(linesFromReservation({ service_ids: [], services: [] }, CATALOG, 'car')).toEqual({
      services: [],
      skipped: [],
    });
  });

  describe('spec 024', () => {
    const PPF = service('ppf', 'PPF', {
      price_motorcycle: null,
      price_car: null,
      estimated_minutes: null,
      on_quote: true,
    });
    const PRO_WASH = service('pro', 'Lavado Pro Wash', {
      price_motorcycle: null,
      motorcycle_prices: {
        street: 44000,
        sbk: 46000,
        scooter: 42000,
        maxi_scooter: 46000,
        trail: 48000,
        maxi_trail: 52000,
        cruiser: 44000,
        maxi_cruiser: 48000,
      },
    });

    it('brings a service «a convenir» with the time staff gave it in the reservation (CA-15)', () => {
      const { services } = linesFromReservation(
        { service_ids: ['ppf'], services: ['PPF'], service_minutes: [240] },
        [PPF],
        'motorcycle'
      );

      expect(services).toEqual([{ ...PPF, estimated_minutes: 240 }]);
    });

    it('brings a service by category for a motorcycle, whatever its category (CA-06, CA-10)', () => {
      const { services, skipped } = linesFromReservation(
        { service_ids: ['pro'], services: ['Lavado Pro Wash'], service_minutes: [null] },
        [PRO_WASH],
        'motorcycle'
      );

      expect(services).toEqual([PRO_WASH]);
      expect(skipped).toEqual([]);
    });
  });

  describe('services that no longer go together (spec 024, RN-06)', () => {
    it('leaves out, named, a service that a service already brought now includes', () => {
      // Booked before the admin made Pro Wash include the sealant.
      const proWash = service('pro', 'Lavado Pro Wash', { includes: ['sellador'] });
      const sellador = service('sellador', 'Sellador');

      expect(
        linesFromReservation(
          { service_ids: ['pro', 'sellador'], services: ['Lavado Pro Wash', 'Sellador'] },
          [proWash, sellador],
          'motorcycle'
        )
      ).toEqual({ services: [proWash], skipped: ['Sellador'] });
    });
  });
});
