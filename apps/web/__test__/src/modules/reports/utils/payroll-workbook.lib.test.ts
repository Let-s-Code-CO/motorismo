/**
 * payroll-workbook.lib — the Excel file of a month's payroll (spec 016, HU-04): what goes in each
 * cell of its two sheets. Writing the .xlsx is the library's job; the route only hands it these.
 *
 * Guards:
 * - CA-18: a «Resumen» sheet (each employee with active days, base salary, base of the month,
 *   commission %, commissions and total, and the total of the month at the end) and a «Detalle»
 *   sheet (each service of each employee). The file is named by its month, and says so when the
 *   month is still provisional.
 * - CA-19: values are numbers and dates are dates, each with its format (Excel adds and sorts
 *   them); a date is the closing day in Colombia (an order closed at 11:30 p. m. on the 30th is on
 *   the 30th, though in UTC it is already the 1st).
 */
import type { PayrollItem, PayrollLine } from '@web/modules/reports/types/reports.types';
import {
  type PayrollWorkbookLabels,
  buildPayrollWorkbook,
  payrollFileName,
} from '@web/modules/reports/utils/payroll-workbook.lib';

const LABELS: PayrollWorkbookLabels = {
  summary: {
    employee: 'Empleado',
    activeDays: 'Días activos',
    monthDays: 'Días del mes',
    baseSalary: 'Salario base',
    basePay: 'Salario del mes',
    commissionPct: 'Comisión (%)',
    commissions: 'Comisiones',
    total: 'Total',
    monthTotal: 'Total del mes',
  },
  detail: {
    employee: 'Empleado',
    closedAt: 'Fecha',
    order: 'Orden',
    service: 'Servicio',
    price: 'Valor',
    share: 'Participación (%)',
    commission: 'Comisión',
  },
};

const line = (overrides: Partial<PayrollLine> = {}): PayrollLine => ({
  employee_id: 'e1',
  employee_name: 'Paula Pineda',
  active_days: 15,
  month_days: 30,
  base_salary: 1300000,
  base_pay: 650000,
  commission_pct: 40,
  commissions: 48000,
  total: 698000,
  ...overrides,
});

const item = (overrides: Partial<PayrollItem & { employee_name: string }> = {}) => ({
  employee_name: 'Paula Pineda',
  order_id: 'o2',
  order_number: 2,
  // 30 Nov at 11:30 p. m. in Bogotá: 1 Dec in UTC.
  closed_at: '2026-12-01T04:30:00Z',
  service_name: 'Micropulido',
  price: 120000,
  share_pct: 100,
  commission: 48000,
  ...overrides,
});

/** The value of a cell, whether it is written plain or as an object with its type. */
const valueOf = (cell: unknown) =>
  cell !== null && typeof cell === 'object' && 'value' in cell ? cell.value : cell;
const valuesOf = (row: unknown[] | undefined) => (row ?? []).map(valueOf);

describe('buildPayrollWorkbook — «Resumen»', () => {
  it('starts with its columns (CA-18)', () => {
    const { summary } = buildPayrollWorkbook([line()], [item()], LABELS);

    expect(valuesOf(summary[0])).toEqual([
      'Empleado',
      'Días activos',
      'Días del mes',
      'Salario base',
      'Salario del mes',
      'Comisión (%)',
      'Comisiones',
      'Total',
    ]);
  });

  it('writes one row per employee, values as numbers in pesos (CA-18, CA-19)', () => {
    const { summary } = buildPayrollWorkbook([line()], [item()], LABELS);

    expect(valuesOf(summary[1])).toEqual([
      'Paula Pineda',
      15,
      30,
      1300000,
      650000,
      40,
      48000,
      698000,
    ]);
    expect(summary[1]![3]).toMatchObject({ type: Number, format: '"$" #,##0' });
    expect(summary[1]![7]).toMatchObject({ type: Number, format: '"$" #,##0' });
    expect(summary[1]![1]).toMatchObject({ type: Number });
  });

  it('ends with the total of the month under «Total»: 698 000 + 1 528 002 = 2 226 002 (CA-18)', () => {
    const { summary } = buildPayrollWorkbook(
      [line(), line({ employee_id: 'e2', employee_name: 'Elkin Estrada', total: 1528002 })],
      [],
      LABELS
    );

    // header + 2 employees + blank + total
    expect(summary).toHaveLength(5);
    const last = summary[4]!;
    expect(valueOf(last[6])).toBe('Total del mes');
    expect(last[7]).toMatchObject({ value: 2226002, type: Number, format: '"$" #,##0' });
  });
});

describe('buildPayrollWorkbook — «Detalle»', () => {
  it('writes each service of each employee, the date as the closing day in Colombia (CA-18, CA-19)', () => {
    const { detail } = buildPayrollWorkbook([line()], [item()], LABELS);

    expect(valuesOf(detail[0])).toEqual([
      'Empleado',
      'Fecha',
      'Orden',
      'Servicio',
      'Valor',
      'Participación (%)',
      'Comisión',
    ]);
    expect(valuesOf(detail[1])).toEqual([
      'Paula Pineda',
      new Date(Date.UTC(2026, 10, 30)),
      2,
      'Micropulido',
      120000,
      100,
      48000,
    ]);
    expect(detail[1]![1]).toMatchObject({ type: Date, format: 'dd/mm/yyyy' });
  });

  it('keeps a commission with its cents, as it was computed (CA-19)', () => {
    const { detail } = buildPayrollWorkbook(
      [line()],
      [item({ commission: 10000.5, price: 33335 })],
      LABELS
    );

    expect(detail[1]![6]).toMatchObject({ value: 10000.5, type: Number, format: '"$" #,##0.00' });
  });
});

describe('payrollFileName', () => {
  it('names the file by its month (CA-18)', () => {
    expect(payrollFileName('2026-11', 'closed')).toBe('liquidacion-2026-11.xlsx');
  });

  it('says when the month is still provisional (CA-18)', () => {
    expect(payrollFileName('2026-11', 'provisional')).toBe('liquidacion-2026-11-provisional.xlsx');
  });
});
