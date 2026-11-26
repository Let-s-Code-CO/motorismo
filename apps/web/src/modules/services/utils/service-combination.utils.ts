/**
 * A service as the forms that choose services know it (spec 024, HU-05): whether it is a package (it
 * has values by category) and what it includes (directly, or already inherited).
 */
export type Combinable = { id: string; name: string; package: boolean; includes: string[] };

/** A service of the catalog as a `Combinable`: a package has values by category (RN-05). */
export const combinableOf = (service: {
  id: string;
  name: string;
  motorcycle_prices: unknown;
  includes: string[];
}): Combinable => ({
  id: service.id,
  name: service.name,
  package: service.motorcycle_prices != null,
  includes: service.includes,
});

/** Packages from the cheapest up, by their lowest value (Pro Wash, Premium, Deluxe, Supreme). */
export const byLowestPrice = (
  a: { motorcycle_prices: Record<string, number> | null },
  b: { motorcycle_prices: Record<string, number> | null }
) => {
  const lowest = (prices: Record<string, number> | null) =>
    prices ? Math.min(...Object.values(prices)) : Infinity;
  return lowest(a.motorcycle_prices) - lowest(b.motorcycle_prices);
};

/** Why a service cannot be chosen, and the chosen service that prevents it. */
export type Unavailable = { reason: 'included' | 'package' | 'overlap'; by: string };

/** A service and everything it includes, inherited (RF-04). */
export const closureOf = (id: string, services: readonly Combinable[]): Set<string> => {
  const byId = new Map(services.map((service) => [service.id, service]));
  const closure = new Set<string>();
  const pending = [id];
  while (pending.length) {
    const next = pending.pop()!;
    if (closure.has(next)) continue;
    closure.add(next);
    pending.push(...(byId.get(next)?.includes ?? []));
  }
  return closure;
};

/**
 * The services that cannot be chosen next to the chosen ones (CA-23 to CA-25), each with why:
 * - `included`: a chosen service already includes it (RN-06);
 * - `package`: a package is already chosen and this is another one (RN-05);
 * - `overlap`: it shares what it includes with a chosen service (RN-06).
 * The chosen services themselves are never in it. The database checks the same on saving (CA-26).
 */
export const unavailableServices = (
  services: readonly Combinable[],
  chosen: readonly string[]
): Map<string, Unavailable> => {
  const unavailable = new Map<string, Unavailable>();
  const picked = services.filter((service) => chosen.includes(service.id));
  const closures = new Map(picked.map((service) => [service.id, closureOf(service.id, services)]));

  for (const service of services) {
    if (chosen.includes(service.id)) continue;
    const including = picked.find((option) => closures.get(option.id)!.has(service.id));
    if (including) {
      unavailable.set(service.id, { reason: 'included', by: including.name });
      continue;
    }
    const otherPackage = service.package && picked.find((option) => option.package);
    if (otherPackage) {
      unavailable.set(service.id, { reason: 'package', by: otherPackage.name });
      continue;
    }
    const own = closureOf(service.id, services);
    const crossing = picked.find((option) =>
      [...closures.get(option.id)!].some((id) => own.has(id))
    );
    if (crossing) unavailable.set(service.id, { reason: 'overlap', by: crossing.name });
  }
  return unavailable;
};
