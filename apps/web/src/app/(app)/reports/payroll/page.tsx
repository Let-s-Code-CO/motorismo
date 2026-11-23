import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getPayrollLines, getPayrollMonth } from '@web/modules/reports/api/payroll.server';
import PayrollScreen from '@web/modules/reports/components/organisms/payroll-screen.component';
import { monthOf, parsePayrollMonth } from '@web/modules/reports/utils/payroll-month.utils';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type PayrollPageProps = { searchParams: Promise<{ month?: string | string[] }> };

/**
 * «Reportes» → «Liquidación» (spec 016, HU-02): admin only (RN-08). A customer or an operator are
 * told they have no permission (CA-20); the database functions refuse them too.
 */
const PayrollPage = async ({ searchParams }: PayrollPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const today = todayIn(new Date());
  const month = parsePayrollMonth((await searchParams).month, today);
  const [state, lines] = await Promise.all([getPayrollMonth(month), getPayrollLines(month)]);

  return <PayrollScreen month={month} currentMonth={monthOf(today)} state={state} lines={lines} />;
};

export default PayrollPage;
