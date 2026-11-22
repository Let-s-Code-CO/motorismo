import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getAgendaDay } from '@web/modules/reservations/api/reservations.server';
import NewReservationScreen from '@web/modules/reservations/components/organisms/new-reservation-screen.component';
import { parseAgendaDate, todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type NewReservationPageProps = { searchParams: Promise<{ date?: string; start?: string }> };

/** «Nueva reserva» (spec 012, HU-01): staff only. A slot chosen in the agenda comes as `start`. */
const NewReservationPage = async ({ searchParams }: NewReservationPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const params = await searchParams;
  const date = parseAgendaDate(params.date, todayIn(new Date()));
  const day = await getAgendaDay(date);

  return <NewReservationScreen day={day} initialStart={params.start ?? null} />;
};

export default NewReservationPage;
