/**
 * vehicle-catalog-errors.utils — the refusals of the catalog functions (spec 018), as message keys.
 *
 * The database says why with a hint; each one becomes a sentence of `vehicles.catalog.errors`. A
 * refusal without a known hint is «forbidden» if it is a permission error (42501) and «generic»
 * otherwise, never a raw database text.
 */
import { fromVehicleCatalogError } from '@web/modules/vehicles/utils/vehicle-catalog-errors.utils';

describe('fromVehicleCatalogError', () => {
  it.each([
    ['catalog_admin_only', 'forbidden'],
    ['catalog_name_taken', 'nameTaken'],
    ['catalog_name_required', 'nameRequired'],
    ['catalog_name_too_long', 'nameTooLong'],
    ['catalog_type_mismatch', 'typeMismatch'],
    ['catalog_brand_mismatch', 'brandMismatch'],
    ['catalog_same_item', 'sameItem'],
    ['catalog_not_found', 'notFound'],
  ])('reads the hint %s as %s', (hint, key) => {
    expect(fromVehicleCatalogError({ code: 'P0001', hint })).toBe(key);
  });

  it('reads a permission error without hint as forbidden', () => {
    expect(fromVehicleCatalogError({ code: '42501', hint: null })).toBe('forbidden');
  });

  it('reads anything else as generic', () => {
    expect(fromVehicleCatalogError({ code: '57014', hint: 'something_else' })).toBe('generic');
  });
});
