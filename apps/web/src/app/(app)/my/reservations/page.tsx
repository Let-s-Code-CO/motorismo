import { requireCustomer } from '@web/modules/auth/api/auth.server';
import PollRefresh from '@web/modules/core/components/poll-refresh.component';
import { getMyReservations } from '@web/modules/customer-area/api/customer-area.server';
import MyReservationsScreen from '@web/modules/customer-area/components/organisms/my-reservations-screen.component';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

/**
 * The customer's «Mis reservas» (spec 014, HU-04), kept up to date every 15 s while it is on screen:
 * more time given by staff, a change or the arrival show without reloading (CA-22).
 */
const MyReservationsPage = async () => {
  await requireCustomer();
  const reservations = await getMyReservations(todayIn(new Date()));

  return (
    <>
      <PollRefresh />
      <MyReservationsScreen reservations={reservations} />
    </>
  );
};

export default MyReservationsPage;
