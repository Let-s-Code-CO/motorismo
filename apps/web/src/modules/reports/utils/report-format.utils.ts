import type { ReportEmployeeShare } from '@web/modules/reports/types/reports.types';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

/** Who took part in a service and their share: «Elkin Estrada 50 % · Paula Pineda 50 %» (CA-13). */
export const employeesText = (employees: ReportEmployeeShare[]) =>
  employees.map(({ name, share }) => `${name} ${share} %`).join(' · ');

/** «Suzuki GSX-R600»: the brand and, if it has one, the line. */
export const vehicleName = (row: { brand_name: string; line_name: string | null }) =>
  [row.brand_name, row.line_name].filter(Boolean).join(' ');

/** The day a service counts on: its order's closing day in Colombia (RN-01), `YYYY-MM-DD`. */
export const closingDay = (closedAt: string) => todayIn(new Date(closedAt));
