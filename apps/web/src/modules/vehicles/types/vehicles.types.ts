import type { Enums, Tables } from '@motorismo/supabase/types';

export type VehicleType = Enums<'vehicle_type'>;
export type VehicleClass = Enums<'vehicle_class'>;
export type VehicleColor = Enums<'vehicle_color'>;

/** Types that carry a plate (RN-02): motorcycles and cars. */
export type PlatedVehicleType = Exclude<VehicleType, 'bicycle'>;

/** Who is looking at the vehicles: staff on a customer record, or the customer themselves. */
export type VehiclesAudience = 'staff' | 'customer';

/**
 * A catalog entry (brand or line) as the form suggests it, with the names it remembers (merged into
 * it, or before a rename; spec 018, CA-16).
 */
export type CatalogItem = { id: string; name: string; aliases?: string[] };

/** A municipality a car plate can be issued in (spec 005, RF-07): DANE code, name, department. */
export type Municipality = Pick<Tables<'municipalities'>, 'code' | 'name' | 'department'>;
