/**
 * vehicle-catalog-filter.utils — what «Marcas y líneas» shows for its cards and its search (spec 018,
 * HU-01).
 *
 * Guards:
 * - CA-03: «Por revisar» are the brands someone typed registering a vehicle that nobody reviewed,
 *   and also a reviewed brand with a line still to review; «Revisadas» are the reviewed brands (the
 *   initial load, and what the admin checked). A reviewed brand with a line to review counts in both.
 * - CA-04: the search keeps the brands whose name, or the name of one of their lines, contains what
 *   is typed, ignoring case, accents, spaces and hyphens (the catalog's rule, spec 005 RN-06).
 */
import type { CatalogBrand, CatalogLine } from '@web/modules/vehicles/types/vehicle-catalog.types';
import {
  catalogCounts,
  filterVehicleCatalog,
  isPendingBrand,
} from '@web/modules/vehicles/utils/vehicle-catalog-filter.utils';

const buildLine = (overrides: Partial<CatalogLine> = {}): CatalogLine => ({
  id: 'line',
  name: 'Línea',
  reviewed: true,
  created_at: '2026-11-19T15:00:00Z',
  vehicles: 0,
  ...overrides,
});

const buildBrand = (overrides: Partial<CatalogBrand> = {}): CatalogBrand => ({
  id: 'brand',
  name: 'Marca',
  reviewed: true,
  created_at: '2026-11-19T15:00:00Z',
  vehicles: 0,
  lines: [],
  ...overrides,
});

const SUZUKI = buildBrand({
  id: 'suzuki',
  name: 'Suzuki',
  lines: [buildLine({ name: 'GSX-R600' })],
});
const SUZUKY = buildBrand({ id: 'suzuky', name: 'Suzuky', reviewed: false });
const HONDA = buildBrand({
  id: 'honda',
  name: 'Honda',
  lines: [buildLine({ name: 'CB 190R' }), buildLine({ name: 'Fz 2.0', reviewed: false })],
});
const CATALOG = [HONDA, SUZUKI, SUZUKY];

const names = (brands: CatalogBrand[]) => brands.map((brand) => brand.name);

describe('isPendingBrand', () => {
  it('is true for a brand someone added and nobody reviewed (CA-03)', () => {
    expect(isPendingBrand(SUZUKY)).toBe(true);
  });

  it('is true for a reviewed brand with a line to review, to review that line (CA-03)', () => {
    expect(isPendingBrand(HONDA)).toBe(true);
  });

  it('is false for a reviewed brand whose lines are all reviewed', () => {
    expect(isPendingBrand(SUZUKI)).toBe(false);
  });
});

describe('catalogCounts', () => {
  it('counts the brands to review and the reviewed ones; Honda counts in both (2 + 2 of 3) (CA-03)', () => {
    expect(catalogCounts(CATALOG)).toEqual({ pending: 2, reviewed: 2 });
  });

  it('counts zero of each in an empty catalog', () => {
    expect(catalogCounts([])).toEqual({ pending: 0, reviewed: 0 });
  });
});

describe('filterVehicleCatalog', () => {
  it('keeps every brand, in its order, with no card and no search', () => {
    expect(names(filterVehicleCatalog(CATALOG, { status: null, q: '' }))).toEqual([
      'Honda',
      'Suzuki',
      'Suzuky',
    ]);
  });

  it('keeps the ones to review with «Por revisar» (CA-03)', () => {
    expect(names(filterVehicleCatalog(CATALOG, { status: 'pending', q: '' }))).toEqual([
      'Honda',
      'Suzuky',
    ]);
  });

  it('keeps the reviewed ones with «Revisadas» (CA-03)', () => {
    expect(names(filterVehicleCatalog(CATALOG, { status: 'reviewed', q: '' }))).toEqual([
      'Honda',
      'Suzuki',
    ]);
  });

  it('finds a brand by part of its name, ignoring case (CA-04)', () => {
    expect(names(filterVehicleCatalog(CATALOG, { status: null, q: 'SUZ' }))).toEqual([
      'Suzuki',
      'Suzuky',
    ]);
  });

  it('finds a brand by one of its lines, ignoring spaces and hyphens: «gsxr» finds Suzuki (CA-04)', () => {
    expect(names(filterVehicleCatalog(CATALOG, { status: null, q: 'gsxr' }))).toEqual(['Suzuki']);
  });

  it('combines the card and the search', () => {
    expect(names(filterVehicleCatalog(CATALOG, { status: 'pending', q: 'suz' }))).toEqual([
      'Suzuky',
    ]);
  });

  it('keeps nothing when nothing matches (CA-04)', () => {
    expect(filterVehicleCatalog(CATALOG, { status: null, q: 'ducati' })).toEqual([]);
  });
});
