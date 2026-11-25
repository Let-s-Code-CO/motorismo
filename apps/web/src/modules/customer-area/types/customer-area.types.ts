import type { Database } from '@motorismo/supabase/types';

import type { WithNulls } from '@web/modules/core/types/with-nulls.types';
import type {
  AgendaDayState,
  AgendaSlot,
  ReservationStatus,
} from '@web/modules/reservations/types/reservations.types';

type Functions = Database['public']['Functions'];

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

/**
 * An active service to choose when booking, for which vehicles it is offered (CA-12) and how long it
 * usually takes, if it has a time (spec 021, RF-02). Never its price.
 */
export type BookableService = WithNulls<
  Functions['bookable_services']['Returns'][number],
  'estimated_minutes'
>;

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
