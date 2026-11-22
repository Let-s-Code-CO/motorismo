import type { Database } from '@motorismo/supabase/types';

import type {
  AgendaDayState,
  AgendaSlot,
  ReservationStatus,
} from '@web/modules/reservations/types/reservations.types';

type Functions = Database['public']['Functions'];

/**
 * The generator marks every column a function returns as not null; these may be null (no line, no
 * plate, not started, not in the queue…), so they say so.
 */
type WithNulls<T, K extends keyof T> = Omit<T, K> & { [P in K]: T[P] | null };

/** One of the customer's vehicles in the shop (spec 014, HU-01), as `my_shop_orders` returns it. */
export type ShopOrder = WithNulls<
  Functions['my_shop_orders']['Returns'][number],
  'line_name' | 'plate' | 'started_at' | 'ahead'
>;

/** A line of an order in the shop: the service and its time, if it has one. */
export type ShopOrderLine = { name: string; estimated_minutes: number | null };

/** A closed order of their history (HU-02), as `my_order_history` returns it. */
export type HistoryOrder = WithNulls<
  Functions['my_order_history']['Returns'][number],
  'line_name' | 'plate'
>;
export type HistoryLine = { name: string; price: number };
export type HistoryPayment = { method: 'cash' | 'transfer' | 'card' | 'other'; amount: number };

/** One of their reservations (HU-04), as `my_reservations` returns it. */
export type MyReservation = Omit<
  WithNulls<
    Functions['my_reservations']['Returns'][number],
    'vehicle_id' | 'vehicle_type' | 'brand_name' | 'line_name' | 'plate' | 'notes' | 'cancel_reason'
  >,
  'status'
> & { status: ReservationStatus };

/** An active service to choose when booking, and for which vehicles it is offered (CA-12). */
export type BookableService = Functions['bookable_services']['Returns'][number];

/** A day to book in: its state and its slots with seats (CA-12, CA-13). */
export type BookableDay = { date: string; state: AgendaDayState; slots: AgendaSlot[] };

/** One of the customer's active vehicles, to book with (CA-12). */
export type MyVehicle = {
  id: string;
  vehicle_type: string;
  brand_name: string | null;
  line_name: string | null;
  plate: string | null;
};
