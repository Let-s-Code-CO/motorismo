import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import {
  getAgendaSettings,
  getAgendaWeek,
} from '@web/modules/reservations/api/reservations.server';
import ScheduleScreen from '@web/modules/reservations/components/organisms/schedule-screen.component';
import {
  parseAgendaDate,
  todayIn,
  weekStartOf,
} from '@web/modules/reservations/utils/agenda-date.utils';

type SchedulePageProps = { searchParams: Promise<{ week?: string }> };

/** «Horario» (spec 012, HU-05): admin only (CA-32; the functions refuse an operator too). */
const SchedulePage = async ({ searchParams }: SchedulePageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const weekStart = weekStartOf(parseAgendaDate((await searchParams).week, todayIn(new Date())));
  const [week, settings] = await Promise.all([getAgendaWeek(weekStart), getAgendaSettings()]);

  // A new week key resets the form when the admin moves to another week.
  return <ScheduleScreen key={weekStart} week={week} settings={settings} />;
};

export default SchedulePage;
