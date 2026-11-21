import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getReservation } from '@web/modules/reservations/api/reservations.server';
import NewOrderScreen from '@web/modules/work-orders/components/organisms/new-order-screen.component';

type NewOrderPageProps = { searchParams: Promise<{ reservation?: string }> };

/**
 * «Nueva orden» (spec 008, HU-01): staff only. With `?reservation=` (spec 012, CA-12), the customer
 * arrived for that reservation: the order starts from it, if it is still pending.
 */
const NewOrderPage = async ({ searchParams }: NewOrderPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const { reservation: reservationId } = await searchParams;
  const reservation = reservationId ? await getReservation(reservationId).catch(() => null) : null;

  return (
    <NewOrderScreen reservation={reservation?.status === 'pending' ? reservation : undefined} />
  );
};

export default NewOrderPage;
