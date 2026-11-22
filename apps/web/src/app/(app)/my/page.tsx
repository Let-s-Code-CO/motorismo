import { requireCustomer } from '@web/modules/auth/api/auth.server';
import PollRefresh from '@web/modules/core/components/poll-refresh.component';
import {
  getMyReservations,
  getMyShopOrders,
} from '@web/modules/customer-area/api/customer-area.server';
import CustomerHome from '@web/modules/customer-area/components/organisms/customer-home.component';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

/**
 * The customer's «Inicio» (spec 014, RF-01): their vehicles in the shop and their next reservation,
 * kept up to date every 15 s while it is on screen (CA-05). Staff are sent to their own home.
 */
const MyHomePage = async () => {
  const customer = await requireCustomer();
  const [orders, reservations] = await Promise.all([
    getMyShopOrders(),
    getMyReservations(todayIn(new Date())),
  ]);
  const next = reservations.find((reservation) => reservation.status === 'pending') ?? null;

  return (
    <>
      <PollRefresh />
      <CustomerHome name={customer.full_name} orders={orders} next={next} />
    </>
  );
};

export default MyHomePage;
