import type { Enums } from '@motorismo/supabase/types';

export type VehicleType = Enums<'vehicle_type'>;
export type VehicleClass = Enums<'vehicle_class'>;
export type VehicleColor = Enums<'vehicle_color'>;

/** Types that carry a plate (RN-02): motorcycles and cars. */
export type PlatedVehicleType = Exclude<VehicleType, 'bicycle'>;

/** Who is looking at the vehicles: staff on a customer record, or the customer themselves. */
export type VehiclesAudience = 'staff' | 'customer';

/** A catalog entry (brand or line) as the form suggests it. */
export type CatalogItem = { id: string; name: string };
