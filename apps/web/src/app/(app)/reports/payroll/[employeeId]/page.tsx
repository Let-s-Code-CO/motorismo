import { notFound } from 'next/navigation';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import {
  getPayrollBaseParts,
  getPayrollItems,
  getPayrollLines,
  getPayrollPeriod,
} from '@web/modules/reports/api/payroll.server';
import PayrollEmployeeDetail from '@web/modules/reports/components/organisms/payroll-employee-detail.component';
import { payrollQuerySchema } from '@web/modules/reports/schemas/reports.schema';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type PayrollEmployeePageProps = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * An employee's payroll of a period (spec 020, CA-04; spec 016, CA-11): admin only (spec 016, RN-08).
 * An employee who is not in that period's payroll is not found.
 */
const PayrollEmployeePage = async ({ params, searchParams }: PayrollEmployeePageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;
  if (staff.role !== 'admin') return <NoPermission audience="operator" />;

  const { employeeId } = await params;
  if (!UUID.test(employeeId)) notFound();
  const query = payrollQuerySchema(todayIn(new Date())).parse(await searchParams);
  const [state, lines, parts, items] = await Promise.all([
    getPayrollPeriod(query),
    getPayrollLines(query),
    getPayrollBaseParts(query, employeeId),
    getPayrollItems(query, employeeId),
  ]);
  const line = lines.find((candidate) => candidate.employee_id === employeeId);
  if (!line) notFound();

  return (
    <PayrollEmployeeDetail query={query} line={line} parts={parts} items={items} state={state} />
  );
};

export default PayrollEmployeePage;
