/** Message keys under `customerArea.errors`. */
export type CustomerAreaErrorKey =
  | 'forbidden'
  | 'invalidInput'
  | 'customerLimit'
  | 'customerOnly'
  | 'notFound'
  | 'notPending'
  | 'vehicleInvalid'
  | 'vehicleRetired'
  | 'vehicleTaken'
  | 'serviceUnavailable'
  | 'weekDisabled'
  | 'dayClosed'
  | 'slotInvalid'
  | 'slotStarted'
  | 'slotFull'
  | 'onePackage'
  | 'servicesOverlap'
  | 'generic';

const BY_HINT: Record<string, CustomerAreaErrorKey> = {
  reservation_customer_limit: 'customerLimit',
  reservation_customer_only: 'customerOnly',
  reservation_not_found: 'notFound',
  reservation_not_pending: 'notPending',
  reservation_vehicle_invalid: 'vehicleInvalid',
  reservation_vehicle_retired: 'vehicleRetired',
  reservation_vehicle_taken: 'vehicleTaken',
  reservation_service_inactive: 'serviceUnavailable',
  reservation_service_unavailable: 'serviceUnavailable',
  reservation_week_disabled: 'weekDisabled',
  reservation_day_closed: 'dayClosed',
  reservation_slot_invalid: 'slotInvalid',
  reservation_slot_started: 'slotStarted',
  reservation_slot_full: 'slotFull',
  // Spec 024, CA-26: one package, nothing included twice.
  services_one_package: 'onePackage',
  services_overlap: 'servicesOverlap',
};

/**
 * What a refusal of the database means to a customer who books, changes or cancels (spec 014): the
 * same functions as staff answer with a hint; anything unknown is generic.
 */
export const fromCustomerAreaError = (error: { hint?: string | null }): CustomerAreaErrorKey =>
  (error.hint && BY_HINT[error.hint]) || 'generic';
