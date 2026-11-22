import { notFound } from 'next/navigation';

import { z } from 'zod';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getReservation } from '@web/modules/reservations/api/reservations.server';
import { getOrder } from '@web/modules/work-orders/api/work-orders.server';
import OrderDetail from '@web/modules/work-orders/components/organisms/order-detail.component';

type OrderPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; reservation?: string }>;
};

/** One order (spec 008, CA-20): staff only; an unknown id is "not found". */
const OrderPage = async ({ params, searchParams }: OrderPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const order = await getOrder(id);
  if (!order) notFound();
  const { saved, reservation: reservationId } = await searchParams;
  // Spec 012: the customer arrived for a reservation and this order was already open for the vehicle.
  const reservation =
    reservationId && z.uuid().safeParse(reservationId).success
      ? await getReservation(reservationId)
      : null;

  return (
    <OrderDetail
      order={order}
      isAdmin={staff.role === 'admin'}
      saved={saved === 'opened' ? 'opened' : undefined}
      reservation={reservation?.status === 'pending' ? reservation : undefined}
    />
  );
};

export default OrderPage;
