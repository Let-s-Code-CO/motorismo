import { parsePesos } from '@web/modules/core/utils/money.utils';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import type { ServiceOption } from '@web/modules/work-orders/types/work-orders.types';

/** The reference price of a service for a vehicle type, or null if it is not offered (CA-03). */
export const referencePrice = (service: ServiceOption, type: VehicleType) =>
  type === 'motorcycle'
    ? service.price_motorcycle
    : type === 'car'
      ? service.price_car
      : service.price_bicycle;

/** A value as the form holds it («25.000», 25000 or blank) → pesos, or null while blank/invalid. */
export const typedPesos = (raw: unknown): number | null => {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return parsePesos(raw);
};
