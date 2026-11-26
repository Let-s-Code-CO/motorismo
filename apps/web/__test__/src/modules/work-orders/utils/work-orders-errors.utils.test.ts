/**
 * work-orders-errors.utils — what the order functions' refusals mean to staff (spec 008).
 *
 * Spec 024, CA-26: an order with two packages, or with services that share what they include, is
 * refused by the database even when the app is skipped; each says why.
 */
import { fromWorkOrderError } from '@web/modules/work-orders/utils/work-orders-errors.utils';

describe('fromWorkOrderError', () => {
  it.each([
    ['services_one_package', 'onePackage'],
    ['services_overlap', 'servicesOverlap'],
    ['work_order_vehicle_busy', 'vehicleBusy'],
  ])('maps %s to %s', (hint, key) => {
    expect(fromWorkOrderError({ hint })).toBe(key);
  });

  it('says something generic for anything else, or no hint at all', () => {
    expect(fromWorkOrderError({ hint: 'something_new' })).toBe('generic');
    expect(fromWorkOrderError({})).toBe('generic');
  });
});
