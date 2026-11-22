import { notFound } from 'next/navigation';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import {
  getAgendaDay,
  getAgendaSettings,
  getReservation,
  listReservationExtensions,
} from '@web/modules/reservations/api/reservations.server';
import EditReservationScreen from '@web/modules/reservations/components/organisms/edit-reservation-screen.component';
import ReservationDetail from '@web/modules/reservations/components/organisms/reservation-detail.component';
import { parseAgendaDate, todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type ReservationPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; date?: string; from?: string }>;
};

/**
 * A reservation (spec 012, CA-11), staff only; with `?edit=1`, changing it while pending (CA-20),
 * on the day of `?date=` (its own by default). With `?from=orders`, «Volver» goes back to «Órdenes».
 */
const ReservationPage = async ({ params, searchParams }: ReservationPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const { id } = await params;
  const query = await searchParams;
  const [reservation, settings, extensions] = await Promise.all([
    getReservation(id),
    getAgendaSettings(),
    listReservationExtensions(id),
  ]);
  if (!reservation) notFound();
  const today = todayIn(new Date());

  if (query.edit === '1' && reservation.status === 'pending') {
    const day = await getAgendaDay(parseAgendaDate(query.date, reservation.day ?? today));
    return <EditReservationScreen day={day} reservation={reservation} />;
  }

  return (
    <ReservationDetail
      reservation={reservation}
      today={today}
      isAdmin={staff.role === 'admin'}
      generalTolerance={settings.tolerance_minutes}
      extensions={extensions}
      // Opened from «Órdenes» (a reservation on its way): «Volver» goes back there.
      backTo={query.from === 'orders' ? 'orders' : 'agenda'}
    />
  );
};

export default ReservationPage;
