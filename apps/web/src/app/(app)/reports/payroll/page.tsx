import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getPayrollLines, getPayrollPeriod } from '@web/modules/reports/api/payroll.server';
import PayrollScreen from '@web/modules/reports/components/organisms/payroll-screen.component';
import { payrollQuerySchema } from '@web/modules/reports/schemas/reports.schema';
import { fortnightOf } from '@web/modules/reports/utils/payroll-period.utils';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type PayrollPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * «Reportes» → «Liquidación» (spec 020; spec 016, HU-02): admin only (spec 016, RN-08). A customer or
 * an operator are told they have no permission; the database functions refuse them too. The period
 * and method come from the address (CA-10), the fortnight in progress by default (CA-09).
 */
const PayrollPage = async ({ searchParams }: PayrollPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const today = todayIn(new Date());
  const query = payrollQuerySchema(today).parse(await searchParams);
  const [state, lines] = await Promise.all([getPayrollPeriod(query), getPayrollLines(query)]);

  return (
    <PayrollScreen
      query={query}
      currentFortnight={fortnightOf(today)}
      state={state}
      lines={lines}
    />
  );
};

export default PayrollPage;
