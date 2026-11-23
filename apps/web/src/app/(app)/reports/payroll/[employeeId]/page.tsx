import { notFound } from 'next/navigation';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import {
  getPayrollItems,
  getPayrollLines,
  getPayrollMonth,
} from '@web/modules/reports/api/payroll.server';
import PayrollEmployeeDetail from '@web/modules/reports/components/organisms/payroll-employee-detail.component';
import { parsePayrollMonth } from '@web/modules/reports/utils/payroll-month.utils';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type PayrollEmployeePageProps = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An employee's payroll of a month (spec 016, CA-11): admin only (RN-08, CA-20). An employee who
 * is not in that month's payroll is not found.
 */
const PayrollEmployeePage = async ({ params, searchParams }: PayrollEmployeePageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const { employeeId } = await params;
  if (!UUID.test(employeeId)) notFound();
  const month = parsePayrollMonth((await searchParams).month, todayIn(new Date()));
  const [state, lines, items] = await Promise.all([
    getPayrollMonth(month),
    getPayrollLines(month),
    getPayrollItems(month, employeeId),
  ]);
  const line = lines.find((candidate) => candidate.employee_id === employeeId);
  if (!line) notFound();

  return <PayrollEmployeeDetail month={month} line={line} items={items} status={state.status} />;
};

export default PayrollEmployeePage;
