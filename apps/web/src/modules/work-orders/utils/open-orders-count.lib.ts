import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@motorismo/supabase/types';

import type { OpenOrdersCount } from '@web/modules/auth/utils/open-orders-summary.utils';

/**
 * How many open orders are in progress (started) and how many queued (spec 009, CA-07; spec 008,
 * RN-12), read with the given client, so with its session and RLS: a customer counts nothing. Two
 * counts without rows: cheap however long the queue.
 */
export const countOpenOrders = async (
  supabase: SupabaseClient<Database>
): Promise<OpenOrdersCount> => {
  const open = () =>
    supabase.from('work_orders').select('id', { count: 'exact', head: true }).eq('status', 'open');
  const [inProgress, queued] = await Promise.all([
    open().not('started_at', 'is', null),
    open().is('started_at', null),
  ]);
  const error = inProgress.error ?? queued.error;
  if (error) throw new Error(`Could not count the open orders: ${error.message}`);
  return { inProgress: inProgress.count ?? 0, queued: queued.count ?? 0 };
};
