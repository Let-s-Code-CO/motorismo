/**
 * openOrdersSummary — what the «Órdenes» tile of the staff home says about the car wash (spec 009,
 * CA-07): how many open orders are being worked on and how many wait in the queue.
 *
 * Guards:
 * - CA-07: with no open order it says so («Sin órdenes abiertas») instead of «0 en proceso · 0 en
 *   cola»; otherwise it gives both numbers, even when one of them is 0.
 * - RN-03 (spec 008, RN-12): in progress = open and started; queued = open, not started. The counts
 *   arrive already split; this only decides what to say.
 */
import { openOrdersSummary } from '@web/modules/auth/utils/open-orders-summary.utils';

describe('openOrdersSummary', () => {
  it('says there is nothing open when both counts are 0 (CA-07)', () => {
    expect(openOrdersSummary({ inProgress: 0, queued: 0 })).toEqual({ kind: 'none' });
  });

  it('gives both numbers when something is open, even a 0 (CA-07)', () => {
    expect(openOrdersSummary({ inProgress: 1, queued: 0 })).toEqual({
      kind: 'some',
      inProgress: 1,
      queued: 0,
    });
    expect(openOrdersSummary({ inProgress: 0, queued: 3 })).toEqual({
      kind: 'some',
      inProgress: 0,
      queued: 3,
    });
  });

  it('keeps the numbers as they come: 2 in progress and 1 queued (CA-07, RN-03)', () => {
    expect(openOrdersSummary({ inProgress: 2, queued: 1 })).toEqual({
      kind: 'some',
      inProgress: 2,
      queued: 1,
    });
  });
});
