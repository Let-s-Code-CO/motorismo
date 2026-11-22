import type { MyVehicle } from '@web/modules/customer-area/types/customer-area.types';

/** A vehicle of «Mis vehículos» (spec 005) as the customer chooses it to book (spec 014, CA-12). */
export const toMyVehicle = (vehicle: {
  id: string;
  vehicle_type: string;
  plate: string | null;
  brand: { name: string } | null;
  line: { name: string } | null;
}): MyVehicle => ({
  id: vehicle.id,
  vehicle_type: vehicle.vehicle_type,
  brand_name: vehicle.brand?.name ?? null,
  line_name: vehicle.line?.name ?? null,
  plate: vehicle.plate,
});
