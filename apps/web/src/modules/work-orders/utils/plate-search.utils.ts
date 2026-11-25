import { normalizePlate } from '@web/modules/vehicles/utils/plate.utils';

/**
 * What a customer search looks for among plates (spec 022, CA-11): the text written as plates are
 * stored (uppercase, without spaces, hyphens or dots), only when it could be part of a plate —
 * letters and digits, at least two. Otherwise null: no plate is looked for.
 */
export const plateQuery = (search: string): string | null => {
  const query = normalizePlate(search.trim());
  return /^[A-Z0-9]{2,}$/.test(query) ? query : null;
};

/** The plate a result matched by, with the city that issued it if it is a car's (spec 005, HU-07). */
export type MatchedPlate = { plate: string; city: string | null };

/**
 * For each customer, the first of their plates that contains the plate query (CA-11): the plate a
 * result matched by, with its city. Customers found by name, phone or email have none.
 */
export const matchedPlates = (
  vehicles: readonly {
    customer_id: string;
    plate: string | null;
    plate_city: { name: string } | null;
  }[],
  query: string
): Map<string, MatchedPlate> => {
  const found = new Map<string, MatchedPlate>();
  for (const { customer_id, plate, plate_city } of vehicles) {
    if (plate?.includes(query) && !found.has(customer_id)) {
      found.set(customer_id, { plate, city: plate_city?.name ?? null });
    }
  }
  return found;
};
