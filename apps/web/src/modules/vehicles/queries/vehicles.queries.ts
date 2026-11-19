import { queryOptions } from '@tanstack/react-query';

import { fetchBrands, fetchLines } from '@web/modules/vehicles/api/vehicles.client';
import { vehicleKeys } from '@web/modules/vehicles/queries/vehicles.keys';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';

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
