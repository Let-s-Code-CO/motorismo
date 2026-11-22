import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import type { ServiceOption } from '@web/modules/work-orders/types/work-orders.types';
import { referencePrice } from '@web/modules/work-orders/utils/line-price.utils';

type BookedServices = { service_ids: string[] | null; services: string[] | null };

/**
 * The services a reservation intended, as the order opened on arrival offers them (spec 012, CA-12,
 * RN-07): the active ones with a price for the vehicle's type, as the catalog has them now and in
 * the booked order; the others are named in `skipped`, not copied.
 */
export const linesFromReservation = (
  reservation: BookedServices,
  catalog: ServiceOption[],
  type: VehicleType
) => {
  const services: ServiceOption[] = [];
  const skipped: string[] = [];
  (reservation.service_ids ?? []).forEach((id, index) => {
    const service = catalog.find((candidate) => candidate.id === id);
    if (service && referencePrice(service, type) !== null) services.push(service);
    else skipped.push(service?.name ?? reservation.services?.[index] ?? '');
  });
  return { services, skipped };
};
