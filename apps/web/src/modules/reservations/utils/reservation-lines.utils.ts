import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import type { ServiceOption } from '@web/modules/work-orders/types/work-orders.types';
import { isOffered } from '@web/modules/work-orders/utils/line-price.utils';

type BookedServices = {
  service_ids: string[] | null;
  services: string[] | null;
  /** The time staff gave each service «a convenir» when booking (spec 024, CA-14), else null. */
  service_minutes?: (number | null)[] | null;
};

/**
 * The services a reservation intended, as the order opened on arrival offers them (spec 012, CA-12,
 * RN-07): the active ones with a price for the vehicle's type, as the catalog has them now and in
 * the booked order; the others are named in `skipped`, not copied. A service «a convenir» brings the
 * time given to it in the reservation (spec 024, CA-15).
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
    const minutes = reservation.service_minutes?.[index] ?? null;
    if (service && isOffered(service, type))
      services.push(
        service.on_quote && minutes !== null ? { ...service, estimated_minutes: minutes } : service
      );
    else skipped.push(service?.name ?? reservation.services?.[index] ?? '');
  });
  return { services, skipped };
};
