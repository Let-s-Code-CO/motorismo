import type { Cell, Row, SheetData } from 'write-excel-file/node';

import type {
  PayrollItem,
  PayrollLine,
  PayrollStatus,
} from '@web/modules/reports/types/reports.types';
import { closingDay } from '@web/modules/reports/utils/report-format.utils';

/** The texts of the file, from `reports.payroll.export` (the route translates them). */
export type PayrollWorkbookLabels = {
  summary: Record<
    | 'employee'
    | 'activeDays'
    | 'monthDays'
    | 'baseSalary'
    | 'basePay'
    | 'commissionPct'
    | 'commissions'
    | 'total'
    | 'monthTotal',
    string
  >;
  detail: Record<
    'employee' | 'closedAt' | 'order' | 'service' | 'price' | 'share' | 'commission',
    string
  >;
};

/** A service of the detail, with whose it is. */
export type PayrollWorkbookItem = PayrollItem & { employee_name: string };

const PESOS = '"$" #,##0';
/** A commission keeps its cents, as it was computed (RN-05 rounds only the employee's sum). */
const PESOS_CENTS = '"$" #,##0.00';
const SUMMARY_COLUMNS = 8;

const bold = (value: string): Cell => ({ value, fontWeight: 'bold' });
const money = (value: number, format = PESOS): Cell => ({ value, type: Number, format });
const number = (value: number): Cell => ({ value, type: Number });
/** A day as Excel keeps it: a date with no time zone, so it opens as that day anywhere. */
const day = (closedAt: string): Cell => ({
  value: new Date(`${closingDay(closedAt)}T00:00:00Z`),
  type: Date,
  format: 'dd/mm/yyyy',
});

/**
 * The cells of a month's payroll in Excel (spec 016, HU-04): «Resumen», one row per employee and
 * the total of the month; «Detalle», each service of each employee. Dates as dates and values as
 * numbers (CA-19).
 */
export const buildPayrollWorkbook = (
  lines: PayrollLine[],
  items: PayrollWorkbookItem[],
  { summary: s, detail: d }: PayrollWorkbookLabels
): { summary: SheetData; detail: SheetData } => {
  const monthTotal: Row = Array.from({ length: SUMMARY_COLUMNS }, () => null);
  monthTotal[SUMMARY_COLUMNS - 2] = bold(s.monthTotal);
  monthTotal[SUMMARY_COLUMNS - 1] = money(lines.reduce((sum, line) => sum + line.total, 0));

  const summary: SheetData = [
    [
      s.employee,
      s.activeDays,
      s.monthDays,
      s.baseSalary,
      s.basePay,
      s.commissionPct,
      s.commissions,
      s.total,
    ].map(bold),
    ...lines.map((line): Row => [
      line.employee_name,
      number(line.active_days),
      number(line.month_days),
      money(line.base_salary),
      money(line.base_pay),
      number(line.commission_pct),
      money(line.commissions),
      money(line.total),
    ]),
    Array.from({ length: SUMMARY_COLUMNS }, () => null),
    monthTotal,
  ];

  const detail: SheetData = [
    [d.employee, d.closedAt, d.order, d.service, d.price, d.share, d.commission].map(bold),
    ...items.map((item): Row => [
      item.employee_name,
      day(item.closed_at),
      number(item.order_number),
      item.service_name,
      money(item.price),
      number(item.share_pct),
      money(item.commission, PESOS_CENTS),
    ]),
  ];

  return { summary, detail };
};

/** Widths of the columns, in characters. */
export const PAYROLL_SUMMARY_COLUMNS = [28, 12, 12, 14, 14, 14, 14, 14].map((width) => ({ width }));
export const PAYROLL_DETAIL_COLUMNS = [28, 12, 8, 26, 12, 16, 14].map((width) => ({ width }));

/** «liquidacion-2026-11.xlsx», or «…-provisional.xlsx» while the month is not closed (CA-18). */
export const payrollFileName = (month: string, status: PayrollStatus) =>
  `liquidacion-${month}${status === 'provisional' ? '-provisional' : ''}.xlsx`;
