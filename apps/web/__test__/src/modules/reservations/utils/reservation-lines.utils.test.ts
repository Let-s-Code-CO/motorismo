/**
 * reservation-lines.utils — what a reservation brings to the order opened when the customer arrives
 * (spec 012, CA-12, RN-07).
 *
 * The services of a reservation are an intention: on arrival, each one is offered as a line with
 * the catalog's value and time of that moment for the vehicle's type, in the order they were
 * booked. A service no longer active, or not offered for that type, is not copied: it is named so
 * staff can tell the customer.
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
  price_car: 40000,
  price_bicycle: null,
  estimated_minutes: 30,
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
});
