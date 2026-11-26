/**
 * reservations-errors.utils — what the agenda's database refusals mean to the person (spec 012).
 *
 * The functions that book, change, cancel and configure check every rule again (RN-02, RN-05) and
 * refuse with a hint; the screen shows its message. A day that cannot hold a slot names the day
 * («agenda_day_invalid:2030-06-11», CA-30) so the error goes next to it.
 */
import {
  dayOfError,
  fromReservationError,
} from '@web/modules/reservations/utils/reservations-errors.utils';

describe('fromReservationError', () => {
  it.each([
    ['reservation_staff_only', 'forbidden'],
    ['agenda_admin_only', 'adminOnly'],
    ['reservation_admin_only', 'adminOnly'],
    ['reservation_slot_full', 'slotFull'],
    ['reservation_slot_started', 'slotStarted'],
    ['reservation_slot_invalid', 'slotInvalid'],
    ['reservation_day_closed', 'dayClosed'],
    ['reservation_week_disabled', 'weekDisabled'],
    ['reservation_vehicle_taken', 'vehicleTaken'],
    ['reservation_vehicle_retired', 'vehicleRetired'],
    ['reservation_vehicle_invalid', 'vehicleInvalid'],
    ['reservation_customer_disabled', 'customerDisabled'],
    ['reservation_customer_not_found', 'notFound'],
    ['reservation_not_found', 'notFound'],
    ['reservation_service_inactive', 'serviceUnavailable'],
    ['reservation_service_unavailable', 'serviceUnavailable'],
    // Spec 024, CA-14 / CA-16.
    ['reservation_quoted_minutes_required', 'quotedMinutesRequired'],
    ['reservation_service_quoted', 'serviceUnavailable'],
    ['reservation_not_pending', 'notPending'],
    ['reservation_no_show_too_early', 'noShowTooEarly'],
    ['reservation_tolerance_out_of_range', 'toleranceOutOfRange'],
    ['reservation_tolerance_max', 'toleranceMax'],
    ['reservation_tolerance_passed', 'tolerancePassed'],
    ['agenda_settings_out_of_range', 'settingsOutOfRange'],
    ['agenda_week_invalid', 'weekInvalid'],
    ['agenda_day_invalid:2030-06-11', 'dayInvalid'],
  ])('maps %s to %s', (hint, key) => {
    expect(fromReservationError({ hint })).toBe(key);
  });

  it('says something generic for anything else, or no hint at all', () => {
    expect(fromReservationError({ hint: 'something_new' })).toBe('generic');
    expect(fromReservationError({ hint: null })).toBe('generic');
    expect(fromReservationError({})).toBe('generic');
  });
});

describe('dayOfError', () => {
  it('names the day a week cannot be saved for (CA-30)', () => {
    expect(dayOfError({ hint: 'agenda_day_invalid:2030-06-11' })).toBe('2030-06-11');
  });

  it('is null for any other refusal', () => {
    expect(dayOfError({ hint: 'reservation_slot_full' })).toBeNull();
    expect(dayOfError({})).toBeNull();
  });
});
