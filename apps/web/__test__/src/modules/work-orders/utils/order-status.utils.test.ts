/**
 * orderStage — where an order is in the car wash (spec 008, HU-07).
 *
 * Guards CA-32 / CA-33 / RN-12: an open order waits «En cola» until it is started, then it is
 * «En proceso»; closed and voided orders stay what they are, started or not (CA-35).
 */
import { orderStage } from '@web/modules/work-orders/utils/order-status.utils';

describe('orderStage', () => {
  it.each([
    [{ status: 'open', started_at: null }, 'queued'],
    [{ status: 'open', started_at: '2026-11-20T19:00:00Z' }, 'in_progress'],
    [{ status: 'closed', started_at: null }, 'closed'],
    [{ status: 'closed', started_at: '2026-11-20T19:00:00Z' }, 'closed'],
    [{ status: 'voided', started_at: null }, 'voided'],
  ] as const)('%j is %s', (order, stage) => {
    expect(orderStage(order)).toBe(stage);
  });
});
