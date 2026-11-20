/**
 * orderEstimate — how long an order should take and when the vehicle should be ready (spec 008,
 * HU-06).
 *
 * Guards:
 * - CA-29 / RN-11: with every line estimated, the time is their sum (one service after another)
 *   and the vehicle is ready that long after it was received.
 * - CA-30: with lines not estimated, the sum of the others is only a minimum, and the missing ones
 *   are named; with none estimated there is no estimate at all.
 * - CA-34 / RN-12: the ready time counts from when the order was started; an order not started
 *   yet (in the queue, or being opened) has a duration but no ready time.
 */
import { orderEstimate } from '@web/modules/work-orders/utils/order-estimate.utils';

const STARTED = new Date('2026-11-20T19:00:00Z');

describe('orderEstimate', () => {
  it('adds up the lines and gives the ready time, when all are estimated (CA-29)', () => {
    // 30 + 90 = 120 minutes after 19:00 UTC → 21:00 UTC.
    expect(
      orderEstimate(
        [
          { name: 'Lavado sencillo', estimated_minutes: 30 },
          { name: 'Lavado detallado', estimated_minutes: 90 },
        ],
        STARTED
      )
    ).toEqual({
      kind: 'complete',
      minutes: 120,
      missing: [],
      readyAt: new Date('2026-11-20T21:00:00Z'),
    });
  });

  it('gives only a minimum and names the missing lines when some have no time (CA-30)', () => {
    expect(
      orderEstimate(
        [
          { name: 'Lavado sencillo', estimated_minutes: 30 },
          { name: 'Limpieza de cadena', estimated_minutes: null },
        ],
        STARTED
      )
    ).toEqual({
      kind: 'minimum',
      minutes: 30,
      missing: ['Limpieza de cadena'],
      readyAt: new Date('2026-11-20T19:30:00Z'),
    });
  });

  it('has no estimate when no line has a time (CA-30)', () => {
    expect(orderEstimate([{ name: 'Otro', estimated_minutes: null }], STARTED)).toEqual({
      kind: 'none',
      minutes: 0,
      missing: ['Otro'],
      readyAt: null,
    });
  });

  it('has no estimate with no lines yet', () => {
    expect(orderEstimate([], STARTED).kind).toBe('none');
  });

  it('gives the duration but no ready time to an order not started yet (CA-34, RN-12)', () => {
    expect(orderEstimate([{ name: 'Lavado sencillo', estimated_minutes: 30 }], null)).toEqual({
      kind: 'complete',
      minutes: 30,
      missing: [],
      readyAt: null,
    });
  });
});
