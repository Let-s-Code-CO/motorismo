import { Constants, type Enums } from '@motorismo/supabase/types';

/** A motorcycle's category (spec 024, RF-01), as the database names it. */
export type MotorcycleCategory = Enums<'motorcycle_category'>;

/**
 * The eight categories, in the order of the business's price list: Street/Roadster, SBK/SSP,
 * Scooter, Maxi Scooter, Trail, Maxi Trail, Cruiser/Clásica and Maxi Cruiser. Their names are in
 * `vehicles.categories`.
 */
export const MOTORCYCLE_CATEGORIES: readonly MotorcycleCategory[] =
  Constants.public.Enums.motorcycle_category;
