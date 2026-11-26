import type { VehiclesAudience } from '@web/modules/vehicles/types/vehicles.types';

/** Message keys under `vehicles.errors`. */
export type VehiclesErrorKey =
  | 'forbidden'
  | 'invalidInput'
  | 'plateTaken'
  | 'plateTakenCustomer'
  | 'plateRequired'
  | 'plateInvalid'
  | 'classRequired'
  | 'lineRequired'
  | 'brandRequired'
  | 'displacementInvalid'
  | 'plateCityRequired'
  | 'plateCityInvalid'
  | 'retired'
  | 'notFound'
  | 'generic';

const BY_HINT: Partial<Record<string, VehiclesErrorKey>> = {
  vehicle_plate_required: 'plateRequired',
  vehicle_plate_invalid: 'plateInvalid',
  vehicle_class_required: 'classRequired',
  vehicle_line_required: 'lineRequired',
  vehicle_brand_required: 'brandRequired',
  vehicle_displacement_invalid: 'displacementInvalid',
  vehicle_plate_city_required: 'plateCityRequired',
  vehicle_plate_city_invalid: 'plateCityInvalid',
  // Spec 023, CA-08: a city that issues no plates is not in the list either.
  vehicle_plate_city_not_issuing: 'plateCityInvalid',
  vehicle_retired: 'retired',
  vehicle_not_found: 'notFound',
};

/**
 * Database refusals (hints of vehicles_guard and save_vehicle, spec 005) → message keys. A taken
 * plate — also the unique index losing a race (23505) — is worded for the audience and never says
 * whose vehicle it is (RN-08, CA-08, CA-25).
 */
export const fromVehicleError = (
  error: { code?: string | null; hint?: string | null },
  audience: VehiclesAudience
): VehiclesErrorKey => {
  if (error.hint === 'vehicle_plate_taken' || error.code === '23505') {
    return audience === 'customer' ? 'plateTakenCustomer' : 'plateTaken';
  }
  const byHint = error.hint ? BY_HINT[error.hint] : undefined;
  if (byHint) return byHint;
  if (error.code === '42501') return 'forbidden';
  return 'generic';
};
