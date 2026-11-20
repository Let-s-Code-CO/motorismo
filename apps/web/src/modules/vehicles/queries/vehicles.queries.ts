import { queryOptions } from '@tanstack/react-query';

import {
  fetchBrands,
  fetchLines,
  fetchMunicipalities,
} from '@web/modules/vehicles/api/vehicles.client';
import { vehicleKeys } from '@web/modules/vehicles/queries/vehicles.keys';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import { sortPlateCities } from '@web/modules/vehicles/utils/plate-city.utils';

/** The catalog changes rarely (only with really new names): keep it for the session. */
const CATALOG_STALE_TIME = 30 * 60_000;

export const brandsQueryOptions = (type: VehicleType) =>
  queryOptions({
    queryKey: vehicleKeys.brands(type),
    queryFn: () => fetchBrands(type),
    staleTime: CATALOG_STALE_TIME,
  });

export const linesQueryOptions = (brandId: string) =>
  queryOptions({
    queryKey: vehicleKeys.lines(brandId),
    queryFn: () => fetchLines(brandId),
    staleTime: CATALOG_STALE_TIME,
  });

/** RF-07: the municipalities never change in the app's life (a migration loads them): read once. */
export const municipalitiesQueryOptions = () =>
  queryOptions({
    queryKey: vehicleKeys.municipalities(),
    queryFn: fetchMunicipalities,
    staleTime: Infinity,
    gcTime: Infinity,
    // CA-30: in the order of the form (Bogotá, D.C., La Calera, Funza, then alphabetical).
    select: sortPlateCities,
  });
