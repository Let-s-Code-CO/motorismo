import { Constants } from '@motorismo/supabase/types';

import type {
  VehicleClass,
  VehicleColor,
  VehicleType,
} from '@web/modules/vehicles/types/vehicles.types';

/** RF-02, in the order of the form: Motocicleta (preselected, CA-02), Bicicleta, Carro. */
export const VEHICLE_TYPES: readonly VehicleType[] = Constants.public.Enums.vehicle_type;

export const DEFAULT_VEHICLE_TYPE: VehicleType = 'motorcycle';

/** RN-10: the classes of each type (motorcycles have none). */
export const CLASSES_BY_TYPE: Record<VehicleType, readonly VehicleClass[]> = {
  motorcycle: [],
  car: ['automobile', 'utility'],
  bicycle: ['mountain', 'road'],
};

/** RN-09: displacement range of a motorcycle, in cc. */
export const DISPLACEMENT_RANGE = { min: 50, max: 2500 } as const;

/** RN-11: the plate city a car starts with — Bogotá, D.C. (DANE code). */
export const DEFAULT_PLATE_CITY = '11001';

/** CA-30: the cities listed first, in this order — Bogotá, D.C., La Calera, Funza (DANE codes). */
export const PINNED_PLATE_CITIES: readonly string[] = ['11001', '25377', '25286'];

/**
 * The plate city list shows at most this many cities at a time; typing finds the rest. Not
 * virtualised: HeroUI's virtual list scrolls a region the keyboard cannot reach (axe:
 * scrollable-region-focusable), so the list is kept short instead.
 */
export const MAX_PLATE_CITY_OPTIONS = 50;

/** Catalog names are 1–60 characters (same as the database checks). */
export const CATALOG_NAME_MAX = 60;

/** RN-05, in the order of the spec (the database enum keeps the same order). */
export const VEHICLE_COLORS: readonly VehicleColor[] = Constants.public.Enums.vehicle_color;

/**
 * The swatch of each colour. These describe the VEHICLE, not the interface (the UI keeps its
 * neutral palette); light colours get a border in the swatch so they are visible.
 */
export const COLOR_SWATCHES: Record<VehicleColor, string> = {
  black: '#18181b',
  white: '#ffffff',
  gray: '#71717a',
  silver: '#c4c4cc',
  red: '#dc2626',
  burgundy: '#7f1d1d',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#facc15',
  orange: '#f97316',
  brown: '#78350f',
  beige: '#e7d9b8',
  gold: '#c9a227',
  purple: '#7e22ce',
  pink: '#ec4899',
  multicolor: 'conic-gradient(#dc2626, #facc15, #16a34a, #2563eb, #7e22ce, #dc2626)',
};
