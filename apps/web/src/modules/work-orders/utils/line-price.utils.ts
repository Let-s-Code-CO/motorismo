import { parsePesos } from '@web/modules/core/utils/money.utils';
import type { MotorcycleCategory } from '@web/modules/vehicles/constants/motorcycle-categories.constants';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import type { ServiceOption } from '@web/modules/work-orders/types/work-orders.types';

type PricedService = Pick<
  ServiceOption,
  'price_motorcycle' | 'motorcycle_prices' | 'price_car' | 'price_bicycle' | 'on_quote'
>;

/**
 * The reference price of a service for a vehicle (spec 008, CA-03; spec 024): a motorcycle's by its
 * category (CA-10), or the single one. Null when there is none to bring: «a convenir» (CA-13: such a
 * service has no value at all, the database makes sure), a motorcycle without category for a service
 * by category (CA-06), or not offered.
 */
export const referencePrice = (
  service: PricedService,
  type: VehicleType,
  category: MotorcycleCategory | null = null
): number | null => {
  if (type === 'motorcycle') {
    if (service.motorcycle_prices) return category ? service.motorcycle_prices[category] : null;
    return service.price_motorcycle;
  }
  return type === 'car' ? service.price_car : service.price_bicycle;
};

/** Whether a service is offered for a vehicle type: «a convenir», or with a value for it. */
export const isOffered = (service: PricedService, type: VehicleType) =>
  service.on_quote ||
  (type === 'motorcycle'
    ? service.price_motorcycle !== null || service.motorcycle_prices !== null
    : (type === 'car' ? service.price_car : service.price_bicycle) !== null);

/** Whether a service needs the motorcycle's category to bring its value (spec 024, CA-06). */
export const needsCategory = (service: PricedService, type: VehicleType) =>
  type === 'motorcycle' && service.motorcycle_prices !== null;

/** A value as the form holds it («25.000», 25000 or blank) → pesos, or null while blank/invalid. */
export const typedPesos = (raw: unknown): number | null => {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return parsePesos(raw);
};
