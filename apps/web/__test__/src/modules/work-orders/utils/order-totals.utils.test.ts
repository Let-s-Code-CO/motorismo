/**
 * orderTotals — what an order adds up to while it is being put together (spec 008).
 *
 * Guards:
 * - CA-04: the subtotal is the sum of the lines, recomputed with every change (a blank price
 *   counts as nothing until it is typed).
 * - CA-25 / RN-02: the total is the subtotal minus the order's fixed discount; a blank discount is
 *   none. It never goes below zero (an invalid discount is reported by the form, not here).
 */
import { orderTotals } from '@web/modules/work-orders/utils/order-totals.utils';

describe('orderTotals', () => {
  it('adds up the lines and takes off the discount (CA-04, CA-25)', () => {
    // 25.000 + 12.000 = 37.000; minus 2.000 = 35.000.
    expect(orderTotals([{ price: 25000 }, { price: 12000 }], 2000)).toEqual({
      subtotal: 37000,
      discount: 2000,
      total: 35000,
    });
  });

  it('is zero with no lines', () => {
    expect(orderTotals([], null)).toEqual({ subtotal: 0, discount: 0, total: 0 });
  });

  it('counts a blank price or discount as nothing until it is typed', () => {
    expect(orderTotals([{ price: 25000 }, { price: null }], null)).toEqual({
      subtotal: 25000,
      discount: 0,
      total: 25000,
    });
  });

  it('never shows a negative total, even with a discount above the subtotal', () => {
    expect(orderTotals([{ price: 10000 }], 15000).total).toBe(0);
  });
});
