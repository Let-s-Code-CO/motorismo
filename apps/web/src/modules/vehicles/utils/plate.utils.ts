import type { PlatedVehicleType, VehicleType } from '@web/modules/vehicles/types/vehicles.types';

/**
 * Colombian plates (spec 005, RN-02 / RN-03), the same rules as public.vehicles_guard:
 * motorcycle ABC12D or the old ABC12, car ABC123, bicycle none. Stored uppercase without
 * separators; shown with a hyphen after the three letters.
 */
const PLATE_PATTERNS: Record<PlatedVehicleType, RegExp> = {
  motorcycle: /^[A-Z]{3}\d{2}[A-Z]?$/,
  car: /^[A-Z]{3}\d{3}$/,
};

/** "uih-03d", "UIH 03D" → "UIH03D". */
export const normalizePlate = (raw: string): string => raw.replace(/[\s.-]/g, '').toUpperCase();

export const hasPlate = (type: VehicleType): type is PlatedVehicleType => type !== 'bicycle';

export const isValidPlate = (type: PlatedVehicleType, raw: string): boolean =>
  PLATE_PATTERNS[type].test(normalizePlate(raw));

/** "UIH03D" → "UIH-03D", "ABC123" → "ABC-123" (CA-03). */
export const formatPlate = (raw: string): string => {
  const plate = normalizePlate(raw);
  return plate.length > 3 ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
};
