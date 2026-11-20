import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';

/** Query keys of the vehicle catalog and the plate cities (TanStack Query). */
export const vehicleKeys = {
  all: ['vehicles'] as const,
  brands: (type: VehicleType) => [...vehicleKeys.all, 'brands', type] as const,
  lines: (brandId: string) => [...vehicleKeys.all, 'lines', brandId] as const,
  municipalities: () => [...vehicleKeys.all, 'municipalities'] as const,
};
