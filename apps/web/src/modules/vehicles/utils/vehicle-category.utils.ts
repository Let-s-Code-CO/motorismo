import type { MotorcycleCategory } from '@web/modules/vehicles/constants/motorcycle-categories.constants';

/**
 * The category that counts for a motorcycle (spec 024, RN-04): its own, given by staff (CA-03), or
 * else its line's (CA-02); null when neither has one (CA-06, CA-18).
 */
export const vehicleCategory = (vehicle: {
  motorcycle_category: MotorcycleCategory | null;
  line: { motorcycle_category: MotorcycleCategory | null } | null;
}): MotorcycleCategory | null =>
  vehicle.motorcycle_category ?? vehicle.line?.motorcycle_category ?? null;
