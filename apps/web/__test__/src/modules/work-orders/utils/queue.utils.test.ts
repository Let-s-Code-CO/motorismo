/**
 * queue.utils — the order of «En cola» (spec 008, CA-18, amended by spec 012, RN-04).
 *
 * Each order waits by its turn: its arrival, or the time it reserved if the customer arrived
 * within the tolerance (the database fixes `turn_at` when the order opens). Reservations whose time
 * has come but whose customer has not arrived yet are shown in their place, without a turn, so
 * whoever arrives without one knows someone goes first.
 *
 * Guards:
 * - CA-14: the queue goes by turn, earliest first.
 * - CA-15: the example of the spec: 8:00 without reservation, the 9:00 reservation, and 9:00 without
 *   reservation saved before it → 1.º, 2.º, 3.º.
 * - RN-04: the same turn → the reservation first, then by arrival.
 * - CA-18: a reservation on its way sits in its place without a turn number, and disappears once its
 *   tolerance has passed.
 */
import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';
import { queueOf } from '@web/modules/work-orders/utils/queue.utils';

const at = (time: string) => `2030-06-12T${time}-05:00`;

const order = (id: string, overrides: Partial<WorkOrderSummary> = {}) =>
  ({
    id,
    opened_at: at('08:00:00'),
    turn_at: at('08:00:00'),
    reservation_id: null,
    reserved_start: null,
    ...overrides,
  }) as WorkOrderSummary;

const arriving = (id: string, overrides: Partial<ReservationSummary> = {}) =>
  ({
    id,
    slot_start: at('09:00:00'),
    grace_until: at('09:15:00'),
    ...overrides,
  }) as ReservationSummary;

const NOW = new Date(at('09:05:00'));

/** What the queue shows, as «turn id» or «· id» for a reservation on its way. */
const shape = (entries: ReturnType<typeof queueOf>) =>
  entries.map((entry) =>
    entry.kind === 'order' ? `${entry.turn} ${entry.order.id}` : `· ${entry.reservation.id}`
  );

describe('queueOf', () => {
  it('goes by turn, earliest first, numbering the orders (CA-14)', () => {
    const queue = queueOf(
      [order('late', { turn_at: at('08:30:00') }), order('early', { turn_at: at('08:10:00') })],
      [],
      NOW
    );

    expect(shape(queue)).toEqual(['1 early', '2 late']);
  });

  it('puts the 9:00 reservation before whoever arrived at 9:00 without one, though saved later (CA-15)', () => {
    const queue = queueOf(
      [
        order('pablo', { turn_at: at('08:00:00'), opened_at: at('08:00:00') }),
        // Lucía arrived at 9:00 without a reservation and was saved first…
        order('lucia', { turn_at: at('09:00:00'), opened_at: at('09:00:00') }),
        // …Camilo arrived for his 9:00 reservation and was saved at 9:05.
        order('camilo', {
          turn_at: at('09:00:00'),
          opened_at: at('09:05:00'),
          reservation_id: 'r9',
          reserved_start: at('09:00:00'),
        }),
      ],
      [],
      NOW
    );

    expect(shape(queue)).toEqual(['1 pablo', '2 camilo', '3 lucia']);
  });

  it('on the same turn without reservations, goes by arrival (RN-04)', () => {
    const queue = queueOf(
      [
        order('second', { turn_at: at('09:00:00'), opened_at: at('09:02:00') }),
        order('first', { turn_at: at('09:00:00'), opened_at: at('09:01:00') }),
      ],
      [],
      NOW
    );

    expect(shape(queue)).toEqual(['1 first', '2 second']);
  });

  it('shows a reservation on its way in its place, without a turn (CA-18)', () => {
    const queue = queueOf(
      [order('pablo'), order('walk-in', { turn_at: at('09:03:00'), opened_at: at('09:03:00') })],
      [arriving('r9')],
      NOW
    );

    // The walk-in of 9:03 is the 2.º order, behind the 9:00 reservation still on its way.
    expect(shape(queue)).toEqual(['1 pablo', '· r9', '2 walk-in']);
  });

  it('drops a reservation on its way once its tolerance has passed (CA-18)', () => {
    const queue = queueOf([order('pablo')], [arriving('r9')], new Date(at('09:16:00')));

    expect(shape(queue)).toEqual(['1 pablo']);
  });

  it('is empty without orders or reservations', () => {
    expect(queueOf([], [], NOW)).toEqual([]);
  });
});
