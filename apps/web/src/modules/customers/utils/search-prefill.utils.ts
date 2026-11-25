import { formatMobile, normalizeMobile } from '@web/modules/core/utils/phone.utils';
import type { PlatedVehicleType } from '@web/modules/vehicles/types/vehicles.types';
import { formatPlate, isValidPlate, normalizePlate } from '@web/modules/vehicles/utils/plate.utils';

/** Where what was searched goes in «Nuevo cliente». */
export type SearchPrefill = {
  full_name?: string;
  phone?: string;
  vehicle?: { vehicle_type: PlatedVehicleType; plate: string };
};

/**
 * What staff typed in the customer search, put in the field it belongs to when they register the
 * customer they did not find (spec 022, CA-04): a Colombian mobile → «Celular»; a plate → the first
 * vehicle's plate, with the type it belongs to (a car's ABC123 is checked first, since a motorcycle's
 * pattern is looser); anything else → «Nombre completo».
 */
export const prefillFromSearch = (search: string): SearchPrefill => {
  const typed = search.trim();
  if (!typed) return {};

  const mobile = normalizeMobile(typed);
  if (mobile) return { phone: formatMobile(mobile) };

  for (const type of ['car', 'motorcycle'] as const) {
    if (isValidPlate(type, typed)) {
      return { vehicle: { vehicle_type: type, plate: formatPlate(normalizePlate(typed)) } };
    }
  }

  return { full_name: typed };
};
