/**
 * vehicle-catalog.schema — the address of «Marcas y líneas» and the name of a renamed brand or line
 * (spec 018).
 *
 * Guards:
 * - CA-01: the type, the card and the search live in the address; anything invalid falls back to
 *   Motocicleta without filters, so a broken link still opens the screen. The address omits what is
 *   the default, so the plain one stays `/admin/vehicle-catalog`.
 * - CA-10: a name is required and has at most 60 characters (the catalog's limit, spec 005), counted
 *   after trimming.
 */
import {
  catalogNameSchema,
  parseVehicleCatalogFilters,
  vehicleCatalogHref,
} from '@web/modules/vehicles/schemas/vehicle-catalog.schema';

describe('parseVehicleCatalogFilters', () => {
  it('reads the type, the card and the search (CA-01)', () => {
    expect(parseVehicleCatalogFilters({ type: 'car', status: 'pending', q: ' yam ' })).toEqual({
      type: 'car',
      status: 'pending',
      q: 'yam',
    });
  });

  it('falls back to Motocicleta without filters when nothing is given (CA-01)', () => {
    expect(parseVehicleCatalogFilters({})).toEqual({ type: 'motorcycle', status: null, q: '' });
  });

  it('ignores an unknown type or card instead of failing (CA-01)', () => {
    expect(parseVehicleCatalogFilters({ type: 'boat', status: 'old' })).toEqual({
      type: 'motorcycle',
      status: null,
      q: '',
    });
  });
});

describe('vehicleCatalogHref', () => {
  it('is the plain address for Motocicleta without filters', () => {
    expect(vehicleCatalogHref({ type: 'motorcycle', status: null, q: '' })).toBe(
      '/admin/vehicle-catalog'
    );
  });

  it('writes the type, the card and the search when they are not the default (CA-01)', () => {
    expect(vehicleCatalogHref({ type: 'car', status: 'reviewed', q: 'ma zda' })).toBe(
      '/admin/vehicle-catalog?type=car&status=reviewed&q=ma+zda'
    );
  });
});

describe('catalogNameSchema', () => {
  it('trims the name (CA-10)', () => {
    expect(catalogNameSchema.parse({ name: '  Royal Enfield ' })).toEqual({
      name: 'Royal Enfield',
    });
  });

  it('refuses an empty name, also only spaces (CA-10)', () => {
    expect(catalogNameSchema.safeParse({ name: '   ' }).error?.issues[0]?.message).toBe('required');
  });

  it('takes 60 characters and refuses 61 (CA-10)', () => {
    expect(catalogNameSchema.safeParse({ name: 'a'.repeat(60) }).success).toBe(true);
    expect(catalogNameSchema.safeParse({ name: 'a'.repeat(61) }).error?.issues[0]?.message).toBe(
      'tooLong'
    );
  });
});
