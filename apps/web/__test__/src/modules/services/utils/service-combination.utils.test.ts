/**
 * service-combination.utils — which services can still be chosen next to the chosen ones (spec 024,
 * HU-05), in the reservation of staff and of the customer and in the order.
 *
 * Guards:
 * - RF-04: what a service includes is inherited (Premium → kit → desengrasado y lubricado →
 *   desengrasado).
 * - CA-24: what a chosen service includes, also through others, is «Incluido en {servicio}».
 * - CA-23 / RN-05: with a package chosen, another package is «Ya hay un paquete: {paquete}».
 * - CA-25 / RN-06: two services that share what they include cannot go together: «Se cruza con …».
 * - A chosen service is never unavailable itself; with nothing chosen, everything is available.
 * The database checks the same rules on saving (CA-26).
 */
import {
  type Combinable,
  byLowestPrice,
  closureOf,
  unavailableServices,
} from '@web/modules/services/utils/service-combination.utils';

/** The price list's services and what each includes directly (CA-22). */
const service = (id: string, includes: string[] = [], isPackage = false): Combinable => ({
  id,
  name: id,
  package: isPackage,
  includes,
});
const CATALOG: Combinable[] = [
  service('Pro Wash', [], true),
  service('Premium', ['Pro Wash', 'Kit', 'Sellador', 'Asientos'], true),
  service('Deluxe', ['Pro Wash', 'Desengrasado y lubricado'], true),
  service('Kit', ['Desengrasado y lubricado']),
  service('Kit y cubrecadena', ['Kit']),
  service('Desengrasado y lubricado', ['Desengrasado', 'Lubricado']),
  service('Desengrasado'),
  service('Lubricado'),
  service('Sellador'),
  service('Asientos'),
];

describe('closureOf', () => {
  it('is the service and everything it includes, inherited (RF-04)', () => {
    expect([...closureOf('Premium', CATALOG)].sort()).toEqual(
      [
        'Asientos',
        'Desengrasado',
        'Desengrasado y lubricado',
        'Kit',
        'Lubricado',
        'Premium',
        'Pro Wash',
        'Sellador',
      ].sort()
    );
  });

  it('is only the service when it includes nothing', () => {
    expect([...closureOf('Sellador', CATALOG)]).toEqual(['Sellador']);
  });

  it('ends even if the data had a loop (the database refuses one)', () => {
    const looping = [service('A', ['B']), service('B', ['A'])];

    expect([...closureOf('A', looping)].sort()).toEqual(['A', 'B']);
  });
});

describe('unavailableServices', () => {
  it('leaves everything available with nothing chosen', () => {
    expect(unavailableServices(CATALOG, [])).toEqual(new Map());
  });

  it('marks everything a chosen package includes, inherited, as included in it (CA-24)', () => {
    const unavailable = unavailableServices(CATALOG, ['Premium']);

    for (const id of [
      'Pro Wash',
      'Kit',
      'Desengrasado y lubricado',
      'Desengrasado',
      'Lubricado',
      'Sellador',
      'Asientos',
    ])
      expect(unavailable.get(id)).toEqual({ reason: 'included', by: 'Premium' });
  });

  it('allows no second package (CA-23, RN-05)', () => {
    expect(unavailableServices(CATALOG, ['Premium']).get('Deluxe')).toEqual({
      reason: 'package',
      by: 'Premium',
    });
  });

  it('allows no service that shares what a chosen one includes (CA-25, RN-06)', () => {
    // Both include the kit's cleaning.
    expect(unavailableServices(CATALOG, ['Premium']).get('Kit y cubrecadena')).toEqual({
      reason: 'overlap',
      by: 'Premium',
    });
  });

  it('marks a package that includes a chosen extra as crossing it', () => {
    expect(unavailableServices(CATALOG, ['Sellador']).get('Premium')).toEqual({
      reason: 'overlap',
      by: 'Sellador',
    });
  });

  it('leaves available an extra the package does not include', () => {
    const unavailable = unavailableServices(CATALOG, ['Deluxe']);

    expect(unavailable.has('Sellador')).toBe(false);
    expect(unavailable.has('Asientos')).toBe(false);
  });

  it('never marks a chosen service, and allows two that share nothing', () => {
    const unavailable = unavailableServices(CATALOG, ['Pro Wash', 'Sellador']);

    expect(unavailable.has('Pro Wash')).toBe(false);
    expect(unavailable.has('Sellador')).toBe(false);
    expect(unavailable.has('Asientos')).toBe(false);
  });

  it('names the chosen service by its name', () => {
    const named = CATALOG.map((option) =>
      option.id === 'Premium' ? { ...option, name: 'Paquete de lavado Premium' } : option
    );

    expect(unavailableServices(named, ['Premium']).get('Sellador')).toEqual({
      reason: 'included',
      by: 'Paquete de lavado Premium',
    });
  });
});

describe('byLowestPrice', () => {
  it('orders the packages from the cheapest up, by their lowest value (CA-28)', () => {
    const pkg = (name: string, lowest: number) => ({
      name,
      motorcycle_prices: { street: lowest + 2000, scooter: lowest },
    });

    expect(
      [pkg('Supreme', 700000), pkg('Pro Wash', 42000), pkg('Deluxe', 170000), pkg('Premium', 97000)]
        .sort(byLowestPrice)
        .map(({ name }) => name)
    ).toEqual(['Pro Wash', 'Premium', 'Deluxe', 'Supreme']);
  });
});
