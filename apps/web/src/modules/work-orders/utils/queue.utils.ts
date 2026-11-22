import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';

/** An order waiting its turn, or a reservation on its way (no turn: it has not arrived). */
export type QueueEntry =
  | { kind: 'order'; order: WorkOrderSummary; turn: number }
  | { kind: 'arriving'; reservation: ReservationSummary };

const time = (instant: string | null | undefined) => (instant ? new Date(instant).getTime() : 0);

/**
 * «En cola» in its order (spec 008, CA-18; spec 012, RN-04): by turn, earliest first; on the same
 * turn, a reservation before an arrival without one, then by arrival. The reservations whose time
 * has come but whose customer has not arrived yet sit in their place until their tolerance passes
 * (CA-18); only the orders take a turn number (1.º, 2.º…).
 */
export const queueOf = (
  queued: WorkOrderSummary[],
  arriving: ReservationSummary[],
  now: Date
): QueueEntry[] => {
  const keyed = [
    ...queued.map((order) => ({
      entry: { kind: 'order' as const, order },
      turn: time(order.turn_at ?? order.opened_at),
      reserved: !!order.reservation_id,
      arrival: time(order.opened_at),
    })),
    ...arriving
      .filter((reservation) => time(reservation.grace_until) >= now.getTime())
      .map((reservation) => ({
        entry: { kind: 'arriving' as const, reservation },
        turn: time(reservation.slot_start),
        reserved: true,
        arrival: Number.POSITIVE_INFINITY,
      })),
  ].sort(
    (a, b) => a.turn - b.turn || Number(b.reserved) - Number(a.reserved) || a.arrival - b.arrival
  );

  let turn = 0;
  return keyed.map(({ entry }) => (entry.kind === 'order' ? { ...entry, turn: ++turn } : entry));
};

/**
 * How an order stands with its reservation (spec 012, RN-04): it `kept` the reserved time as its
 * turn (arrived within the tolerance), or goes by its arrival because it came `late` or `early`.
 * Null without a reservation.
 */
export const reservationStanding = (order: WorkOrderSummary): 'kept' | 'late' | 'early' | null => {
  if (!order.reserved_start) return null;
  const turn = time(order.turn_at ?? order.opened_at);
  const reserved = time(order.reserved_start);
  return turn === reserved ? 'kept' : turn > reserved ? 'late' : 'early';
};
