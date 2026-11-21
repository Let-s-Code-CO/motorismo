import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getAgendaDay } from '@web/modules/reservations/api/reservations.server';
import AgendaScreen from '@web/modules/reservations/components/organisms/agenda-screen.component';
import { parseAgendaDate, todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type AgendaPageProps = { searchParams: Promise<{ date?: string }> };

/** «Agenda» (spec 012, HU-02): staff only (RLS reads the agenda for staff alone). */
const AgendaPage = async ({ searchParams }: AgendaPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const today = todayIn(new Date());
  const date = parseAgendaDate((await searchParams).date, today);
  const day = await getAgendaDay(date);

  return <AgendaScreen day={day} today={today} isAdmin={staff.role === 'admin'} />;
};

export default AgendaPage;
