import { PINNED_PLATE_CITIES } from '@web/modules/vehicles/constants/vehicle-options.constants';
import type { Municipality } from '@web/modules/vehicles/types/vehicles.types';
import { catalogKey } from '@web/modules/vehicles/utils/catalog-key.utils';

const pinnedRank = (code: string) => {
  const rank = PINNED_PLATE_CITIES.indexOf(code);
  return rank === -1 ? PINNED_PLATE_CITIES.length : rank;
};

const spanish = new Intl.Collator('es', { sensitivity: 'base' });

/**
 * CA-30: the plate cities in the order of the form — Bogotá, D.C., La Calera and Funza first, then
 * the rest alphabetically in Spanish (an accented initial sorts with its letter), a repeated name
 * ordered by its department. Returns a new list.
 */
export const sortPlateCities = <City extends Municipality>(cities: readonly City[]): City[] =>
  [...cities].sort(
    (a, b) =>
      pinnedRank(a.code) - pinnedRank(b.code) ||
      spanish.compare(a.name, b.name) ||
      spanish.compare(a.department, b.department)
  );

/**
 * CA-30: the cities that contain what is typed, ignoring case, accents, spaces and hyphens (the
 * same key as the catalog); those that start with it first, each group in the given order. Nothing
 * typed → the whole list.
 */
export const filterPlateCities = <City extends Municipality>(
  cities: readonly City[],
  query: string
): City[] => {
  const key = catalogKey(query);
  if (!key) return [...cities];

  const matches = cities.filter((city) => catalogKey(city.name).includes(key));
  const starts = matches.filter((city) => catalogKey(city.name).startsWith(key));
  return [...starts, ...matches.filter((city) => !starts.includes(city))];
};
