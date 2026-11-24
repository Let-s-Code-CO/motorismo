import type {
  CatalogBrand,
  VehicleCatalogFilters,
} from '@web/modules/vehicles/types/vehicle-catalog.types';
import { catalogKey } from '@web/modules/vehicles/utils/catalog-key.utils';

/**
 * CA-03: a brand to review: typed by someone and not reviewed yet, or reviewed with a line that is
 * still to review.
 */
export const isPendingBrand = (brand: CatalogBrand): boolean =>
  !brand.reviewed || brand.lines.some((line) => !line.reviewed);

/** The counts of the cards «Por revisar» and «Revisadas» (a brand may count in both, CA-03). */
export const catalogCounts = (brands: CatalogBrand[]) => ({
  pending: brands.filter(isPendingBrand).length,
  reviewed: brands.filter((brand) => brand.reviewed).length,
});

const matches = (brand: CatalogBrand, key: string) =>
  catalogKey(brand.name).includes(key) ||
  brand.lines.some((line) => catalogKey(line.name).includes(key));

/**
 * The brands the screen lists for a card and a search (CA-03, CA-04), in their order. The search
 * looks in the brand and in its lines, with the catalog's rule (case, accents, spaces, hyphens).
 */
export const filterVehicleCatalog = (
  brands: CatalogBrand[],
  { status, q }: Pick<VehicleCatalogFilters, 'status' | 'q'>
): CatalogBrand[] => {
  const key = catalogKey(q);
  return brands.filter(
    (brand) =>
      (status === null || (status === 'pending' ? isPendingBrand(brand) : brand.reviewed)) &&
      (!key || matches(brand, key))
  );
};
