/**
 * customer-area-errors.utils — what a refusal of the database means to a customer who books, changes
 * or cancels their reservations (spec 014).
 *
 * The same functions as staff check every rule (spec 012) and answer with a hint; the customer gets
 * its message, in their words: the app's limit (CA-15, RN-03), someone else's reservation (CA-21), a
 * full slot (CA-14), one that is no longer pending (CA-20)…
 */
import { fromCustomerAreaError } from '@web/modules/customer-area/utils/customer-area-errors.utils';

describe('fromCustomerAreaError', () => {
  it.each([
    ['reservation_customer_limit', 'customerLimit'],
    ['reservation_customer_only', 'customerOnly'],
    ['reservation_slot_full', 'slotFull'],
    // Spec 024, CA-26.
    ['services_one_package', 'onePackage'],
    ['services_overlap', 'servicesOverlap'],
    ['reservation_slot_started', 'slotStarted'],
    ['reservation_slot_invalid', 'slotInvalid'],
    ['reservation_day_closed', 'dayClosed'],
    ['reservation_week_disabled', 'weekDisabled'],
    ['reservation_vehicle_taken', 'vehicleTaken'],
    ['reservation_vehicle_retired', 'vehicleRetired'],
    ['reservation_vehicle_invalid', 'vehicleInvalid'],
    ['reservation_service_inactive', 'serviceUnavailable'],
    ['reservation_service_unavailable', 'serviceUnavailable'],
    ['reservation_not_pending', 'notPending'],
    ['reservation_not_found', 'notFound'],
  ])('maps %s to %s', (hint, key) => {
    expect(fromCustomerAreaError({ hint })).toBe(key);
  });

  it('says something generic for anything else, or no hint at all', () => {
    expect(fromCustomerAreaError({ hint: 'something_new' })).toBe('generic');
    expect(fromCustomerAreaError({ hint: null })).toBe('generic');
    expect(fromCustomerAreaError({})).toBe('generic');
  });
});
