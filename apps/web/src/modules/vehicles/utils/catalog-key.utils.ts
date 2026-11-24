import type { CatalogItem } from '@web/modules/vehicles/types/vehicles.types';

/**
 * RN-06: the key that tells two brand or line names apart — case, accents, spaces and hyphens
 * ignored ("GSX-R600" = "gsx r600"). Same rule as private.catalog_key in the database, so the
 * suggestions match what save_vehicle will reuse.
 */
export const catalogKey = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\s-]/g, '');

/** The keys an entry answers to: its name and the names it remembers (spec 018, CA-16). */
const keysOf = (item: CatalogItem) => [item.name, ...(item.aliases ?? [])].map(catalogKey);

/**
 * Suggestions for what is typed (CA-10, CA-12): the entries that contain it, those that start with
 * it first; everything (in the given order) when nothing is typed. A remembered name (merged into
 * the entry, or its name before a rename) suggests the entry (spec 018, CA-16).
 */
export const filterCatalog = <T extends CatalogItem>(items: T[], query: string): T[] => {
  const key = catalogKey(query);
  if (!key) return items;

  const matches = items.filter((item) => keysOf(item).some((itemKey) => itemKey.includes(key)));
  const starts = matches.filter((item) => keysOf(item).some((itemKey) => itemKey.startsWith(key)));
  return [...starts, ...matches.filter((item) => !starts.includes(item))];
};

/**
 * The entry that IS the typed name (written any way), if the catalog has it (CA-14), also by a name
 * it remembers (spec 018, CA-16).
 */
export const findInCatalog = <T extends CatalogItem>(items: T[], name: string): T | undefined => {
  const key = catalogKey(name);
  return key ? items.find((item) => keysOf(item).includes(key)) : undefined;
};
