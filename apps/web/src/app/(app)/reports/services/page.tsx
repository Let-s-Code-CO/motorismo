import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getServiceReport, listReportEmployees } from '@web/modules/reports/api/reports.server';
import ServicesReportScreen from '@web/modules/reports/components/organisms/services-report-screen.component';
import { defaultPeriod, reportFiltersSchema } from '@web/modules/reports/schemas/reports.schema';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type ServicesReportPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * «Reportes» → «Servicios» (spec 015, HU-01): admin only (RN-04). A customer or an operator are
 * told they have no permission (CA-09); the database functions refuse them too.
 */
const ServicesReportPage = async ({ searchParams }: ServicesReportPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const today = todayIn(new Date());
  const filters = reportFiltersSchema(today).parse(await searchParams);
  const [{ rows, totals }, employees] = await Promise.all([
    getServiceReport(filters),
    listReportEmployees(),
  ]);

  return (
    <ServicesReportScreen
      filters={filters}
      rows={rows}
      totals={totals}
      employees={employees}
      defaultPeriod={defaultPeriod(today)}
    />
  );
};

export default ServicesReportPage;
