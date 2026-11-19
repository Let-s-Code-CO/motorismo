import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';

/** Query keys of the vehicle catalog (TanStack Query). */
export const vehicleKeys = {
  all: ['vehicles'] as const,
  brands: (type: VehicleType) => [...vehicleKeys.all, 'brands', type] as const,
  lines: (brandId: string) => [...vehicleKeys.all, 'lines', brandId] as const,
};
