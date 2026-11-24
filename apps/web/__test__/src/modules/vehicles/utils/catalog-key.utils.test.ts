/**
 * catalog-key.utils — how a typed brand or line is matched against the catalog (spec 005).
 *
 * RN-06: two names are the same brand or line when they match ignoring case, accents, spaces and
 * hyphens. The database stores that key (private.catalog_key) and refuses duplicates with it; the
 * form uses the SAME rule to filter suggestions while typing (CA-10, CA-12), so what the user sees
 * suggested is what the database will reuse. The cases below repeat those of
 * 07_vehicle_catalog.test.sql.
 *
 * Spec 018, CA-16: an entry also answers to the names it remembers (merged into it, or before a
 * rename), so typing «suzuky» after the admin merged it into Suzuki suggests and reuses Suzuki.
 */
import {
  catalogKey,
  filterCatalog,
  findInCatalog,
} from '@web/modules/vehicles/utils/catalog-key.utils';

describe('catalogKey', () => {
  it.each([
    ['GSX-R600', 'gsxr600'],
    ['gsx r600', 'gsxr600'],
    ['GSXR 600', 'gsxr600'],
    ['Citroën', 'citroen'],
    ['  Mazda 2 ', 'mazda2'],
  ])('keys "%s" as "%s" (same as the database)', (name, key) => {
    expect(catalogKey(name)).toBe(key);
  });
});

const SUZUKI_LINES = [
  { id: '1', name: 'GSX-R1000' },
  { id: '2', name: 'GSX-R600' },
  { id: '3', name: 'V-Strom 650' },
  { id: '4', name: 'Best 125' },
];

describe('filterCatalog', () => {
  it('returns everything, in the given order, when nothing is typed (CA-11)', () => {
    expect(filterCatalog(SUZUKI_LINES, '  ')).toEqual(SUZUKI_LINES);
  });

  it('keeps the names that contain the typed text, ignoring case, spaces and hyphens (CA-12)', () => {
    expect(filterCatalog(SUZUKI_LINES, 'gsxr 600').map((item) => item.name)).toEqual(['GSX-R600']);
    expect(filterCatalog(SUZUKI_LINES, 'gsx').map((item) => item.name)).toEqual([
      'GSX-R1000',
      'GSX-R600',
    ]);
  });

  it('lists the names that START with the typed text first (so "suz" puts Suzuki on top)', () => {
    const brands = [
      { id: 'a', name: 'Isuzu' },
      { id: 'b', name: 'Suzuki' },
    ];
    expect(filterCatalog(brands, 'suz').map((item) => item.name)).toEqual(['Suzuki', 'Isuzu']);
  });

  it('returns nothing when no name matches', () => {
    expect(filterCatalog(SUZUKI_LINES, 'ninja')).toEqual([]);
  });
});

describe('findInCatalog', () => {
  it('finds the entry that IS the typed name, written any way (CA-14)', () => {
    expect(findInCatalog(SUZUKI_LINES, 'gsx r600')?.id).toBe('2');
  });

  it('finds nothing for a name that only contains part of an entry (it is a new name)', () => {
    expect(findInCatalog(SUZUKI_LINES, 'GSX')).toBeUndefined();
  });
});

describe('remembered names (spec 018, CA-16)', () => {
  const BRANDS = [
    { id: 'suzuki', name: 'Suzuki', aliases: ['Suzuky'] },
    { id: 'yamaha', name: 'Yamaha' },
  ];

  it('suggests the brand a typed remembered name belongs to: «suzuky» suggests Suzuki', () => {
    expect(filterCatalog(BRANDS, 'suzuky').map((item) => item.name)).toEqual(['Suzuki']);
  });

  it('finds the brand by a remembered name written any way', () => {
    expect(findInCatalog(BRANDS, 'SUZU-KY')?.id).toBe('suzuki');
  });

  it('still lists it once when both its name and a remembered one match', () => {
    expect(filterCatalog(BRANDS, 'suzu').map((item) => item.name)).toEqual(['Suzuki']);
  });
});
