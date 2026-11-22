import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { listArrivingReservations } from '@web/modules/reservations/api/reservations.server';
import { listClosedOrders, listOpenOrders } from '@web/modules/work-orders/api/work-orders.server';
import OrdersScreen from '@web/modules/work-orders/components/organisms/orders-screen.component';

type OrdersPageProps = { searchParams: Promise<{ page?: string }> };

/** «Órdenes» (spec 008, HU-04): staff only (RLS reads the orders for staff alone). */
const OrdersPage = async ({ searchParams }: OrdersPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const requested = Number((await searchParams).page);
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
  const [open, closed, arriving] = await Promise.all([
    listOpenOrders(),
    listClosedOrders(page),
    listArrivingReservations(),
  ]);

  return <OrdersScreen open={open} closed={closed} page={page} arriving={arriving} />;
};

export default OrdersPage;
