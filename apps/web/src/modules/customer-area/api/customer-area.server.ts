import 'server-only';
import { z } from 'zod';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type {
  BookableDay,
  BookableService,
  HistoryOrder,
  MyReservation,
  ShopOrder,
} from '@web/modules/customer-area/types/customer-area.types';

/**
 * What a customer reads of their own (spec 014), with THEIR session: SECURITY DEFINER functions that
 * return only their rows and only the fields they may see (RN-01). Staff get nothing from them.
 */

/** Their vehicles in the shop (HU-01). */
export const getMyShopOrders = async (): Promise<ShopOrder[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('my_shop_orders');
  if (error) throw new Error(`Could not load the orders in the shop: ${error.message}`);
  return data as ShopOrder[];
};

/** A page of their closed orders, newest first, before a date (HU-02, CA-11). */
export const HISTORY_PAGE = 10;
export const getMyHistory = async (before: string | null): Promise<HistoryOrder[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('my_order_history', {
    ...(before ? { p_before: before } : {}),
    p_limit: HISTORY_PAGE,
  });
  if (error) throw new Error(`Could not load the history: ${error.message}`);
  return data as HistoryOrder[];
};

/** Their pending reservations and the others of the last 30 days (HU-04, CA-17). */
export const getMyReservations = async (today: string): Promise<MyReservation[]> => {
  const since = new Date(`${today}T12:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 30);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('my_reservations', {
    p_since: since.toISOString().slice(0, 10),
  });
  if (error) throw new Error(`Could not load the reservations: ${error.message}`);
  return data as MyReservation[];
};

const bookableDaySchema = z.object({
  state: z.enum(['open', 'closed', 'unenabled']),
  slots: z.array(
    z.object({
      slot_start: z.string(),
      slot_end: z.string(),
      seats: z.number(),
      taken: z.number(),
      started: z.boolean(),
    })
  ),
});

/** A day to book in: its state and its slots (CA-12, CA-13). */
export const getBookableDay = async (date: string): Promise<BookableDay> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('bookable_day', { p_day: date });
  if (error) throw new Error(`Could not load the day: ${error.message}`);
  const day = bookableDaySchema.parse(data);
  return { date, ...day };
};

/** The active services to choose when booking (CA-12). */
export const getBookableServices = async (): Promise<BookableService[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('bookable_services');
  if (error) throw new Error(`Could not load the services: ${error.message}`);
  return data;
};
