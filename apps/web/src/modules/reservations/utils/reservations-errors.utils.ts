/** Message keys under `reservations.errors`. */
export type ReservationsErrorKey =
  | 'forbidden'
  | 'adminOnly'
  | 'invalidInput'
  | 'notFound'
  | 'notPending'
  | 'customerDisabled'
  | 'vehicleInvalid'
  | 'vehicleRetired'
  | 'vehicleTaken'
  | 'serviceUnavailable'
  | 'quotedMinutesRequired'
  | 'onePackage'
  | 'servicesOverlap'
  | 'weekDisabled'
  | 'dayClosed'
  | 'slotInvalid'
  | 'slotStarted'
  | 'slotFull'
  | 'noShowTooEarly'
  | 'toleranceOutOfRange'
  | 'toleranceMax'
  | 'tolerancePassed'
  | 'settingsOutOfRange'
  | 'weekInvalid'
  | 'dayInvalid'
  | 'generic';

const BY_HINT: Record<string, ReservationsErrorKey> = {
  reservation_staff_only: 'forbidden',
  agenda_admin_only: 'adminOnly',
  reservation_admin_only: 'adminOnly',
  reservation_not_found: 'notFound',
  reservation_customer_not_found: 'notFound',
  reservation_not_pending: 'notPending',
  reservation_customer_disabled: 'customerDisabled',
  reservation_vehicle_invalid: 'vehicleInvalid',
  reservation_vehicle_retired: 'vehicleRetired',
  reservation_vehicle_taken: 'vehicleTaken',
  reservation_service_inactive: 'serviceUnavailable',
  reservation_service_unavailable: 'serviceUnavailable',
  // Spec 024, CA-14 / CA-16: a service «a convenir» needs its time, and only staff book it.
  reservation_quoted_minutes_required: 'quotedMinutesRequired',
  reservation_service_quoted: 'serviceUnavailable',
  // Spec 024, CA-26: one package, nothing included twice.
  services_one_package: 'onePackage',
  services_overlap: 'servicesOverlap',
  reservation_week_disabled: 'weekDisabled',
  reservation_day_closed: 'dayClosed',
  reservation_slot_invalid: 'slotInvalid',
  reservation_slot_started: 'slotStarted',
  reservation_slot_full: 'slotFull',
  reservation_no_show_too_early: 'noShowTooEarly',
  reservation_tolerance_out_of_range: 'toleranceOutOfRange',
  // Spec 012, CA-34: «+5 min».
  reservation_tolerance_max: 'toleranceMax',
  reservation_tolerance_passed: 'tolerancePassed',
  agenda_settings_out_of_range: 'settingsOutOfRange',
  agenda_week_invalid: 'weekInvalid',
};

const DAY_INVALID = /^agenda_day_invalid:(\d{4}-\d{2}-\d{2})$/;

type DatabaseError = { hint?: string | null };

/** Database refusals of the agenda (hints set by its functions, spec 012) → message keys. */
export const fromReservationError = (error: DatabaseError): ReservationsErrorKey => {
  if (!error.hint) return 'generic';
  if (DAY_INVALID.test(error.hint)) return 'dayInvalid';
  return BY_HINT[error.hint] ?? 'generic';
};

/** The day a week could not be saved for (CA-30), to show the error next to it. */
export const dayOfError = (error: DatabaseError) => DAY_INVALID.exec(error.hint ?? '')?.[1] ?? null;
