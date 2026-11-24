import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';

/**
 * The review state of a brand or line (spec 018, RF-02, RN-07): typed by someone registering a
 * vehicle and still to review («pending»), or reviewed (the initial load, or checked by the admin).
 */
export type CatalogReview = 'pending' | 'reviewed';

/** A line as the admin reviews it: whether it is reviewed, when it was added and how many vehicles use it. */
export type CatalogLine = {
  id: string;
  name: string;
  reviewed: boolean;
  created_at: string;
  vehicles: number;
};

/** A brand of a type as the admin reviews it (CA-01 to CA-03), with its lines (CA-02). */
export type CatalogBrand = CatalogLine & { lines: CatalogLine[] };

/** The address of «Marcas y líneas» (CA-01): the type, the card and the search. */
export type VehicleCatalogFilters = {
  type: VehicleType;
  status: CatalogReview | null;
  q: string;
};
