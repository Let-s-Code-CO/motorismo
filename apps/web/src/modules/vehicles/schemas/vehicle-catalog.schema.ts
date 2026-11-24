import { z } from 'zod';

import {
  CATALOG_NAME_MAX,
  DEFAULT_VEHICLE_TYPE,
  VEHICLE_TYPES,
} from '@web/modules/vehicles/constants/vehicle-options.constants';
import type { VehicleCatalogFilters } from '@web/modules/vehicles/types/vehicle-catalog.types';

const CATALOG_PATH = '/admin/vehicle-catalog';
const REVIEW_STATES = ['pending', 'reviewed'] as const;

const filtersSchema = z.object({
  type: z.enum(VEHICLE_TYPES as [string, ...string[]]).catch(DEFAULT_VEHICLE_TYPE),
  status: z.enum(REVIEW_STATES).nullable().catch(null),
  q: z.string().trim().max(CATALOG_NAME_MAX).catch(''),
});

type RawFilters = { type?: string | null; status?: string | null; q?: string | null };

/** CA-01: the address → the screen's filters; anything invalid falls back to its default. */
export const parseVehicleCatalogFilters = ({
  type,
  status,
  q,
}: RawFilters): VehicleCatalogFilters =>
  filtersSchema.parse({
    type: type ?? DEFAULT_VEHICLE_TYPE,
    status: status ?? null,
    q: q ?? '',
  }) as VehicleCatalogFilters;

/** The address of some filters; the defaults are left out (`/admin/vehicle-catalog`). */
export const vehicleCatalogHref = ({ type, status, q }: VehicleCatalogFilters): string => {
  const params = new URLSearchParams();
  if (type !== DEFAULT_VEHICLE_TYPE) params.set('type', type);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const query = params.toString();
  return query ? `${CATALOG_PATH}?${query}` : CATALOG_PATH;
};

/** CA-10: the new name of a brand or line (the database trims and collapses spaces again). */
export const catalogNameSchema = z.object({
  name: z.string().trim().min(1, 'required').max(CATALOG_NAME_MAX, 'tooLong'),
});

export type CatalogNameInput = z.infer<typeof catalogNameSchema>;

/** The lines of a brand as `vehicle_catalog` returns them (a JSON array). */
export const catalogLinesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    reviewed: z.boolean(),
    created_at: z.string(),
    vehicles: z.number(),
  })
);
