import { z } from 'zod';

import { requireCustomer } from '@web/modules/auth/api/auth.server';
import { HISTORY_PAGE, getMyHistory } from '@web/modules/customer-area/api/customer-area.server';
import HistoryScreen from '@web/modules/customer-area/components/organisms/history-screen.component';

type HistoryPageProps = { searchParams: Promise<{ before?: string }> };

/**
 * The customer's «Historial» (spec 014, HU-02): a page of their closed orders, before `?before=` (a
 * date; anything else is ignored). Staff are sent to their own home.
 */
const HistoryPage = async ({ searchParams }: HistoryPageProps) => {
  await requireCustomer();
  const { before } = await searchParams;
  const since =
    before && z.iso.datetime({ offset: true }).safeParse(before).success ? before : null;
  const orders = await getMyHistory(since);

  return <HistoryScreen orders={orders} before={since} hasMore={orders.length === HISTORY_PAGE} />;
};

export default HistoryPage;
