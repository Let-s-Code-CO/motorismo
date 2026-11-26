/**
 * payroll-workbook.lib — the Excel file of a period's payroll (spec 020, CA-17; spec 016, HU-04):
 * what goes in each cell of its two sheets. Writing the .xlsx is the library's job; the route only
 * hands it these.
 *
 * Guards:
 * - CA-17: «Resumen» opens with the period, whether it is provisional, closed or a query, and the
 *   method of the base salary; then each employee with active days, days of the period, monthly base
 *   salary, base salary of the period, commission %, commissions and total, and the total at the end.
 *   «Detalle» has each service of each employee. The file is named by its period
 *   («liquidacion-2026-11-1a-quincena.xlsx», «liquidacion-2026-11-03-a-2026-11-20.xlsx») and says
 *   when a fortnight is still provisional.
 * - spec 016, CA-19: values are numbers and dates are dates, each with its format (Excel adds and
 *   sorts them); a date is the closing day in Colombia (an order closed at 11:30 p. m. on the 30th is
 *   on the 30th, though in UTC it is already the 1st).
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
    periodDays: 'Días del periodo',
    baseSalary: 'Salario base mensual',
    basePay: 'Salario base del periodo',
    commissionPct: 'Comisión (%)',
    commissions: 'Comisiones',
    total: 'Total',
    periodTotal: 'Total del periodo',
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
  period_days: 15,
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

const HEADING = [
  'Liquidación de empleados · 1.ª quincena de noviembre de 2026',
  'Provisional: se calcula con los datos de ahora',
  'Salario base por «Mes comercial»',
];
const build = (lines: PayrollLine[], items: ReturnType<typeof item>[]) =>
  buildPayrollWorkbook(lines, items, LABELS, HEADING);
/** The heading takes three rows and a blank one: the table starts on the fifth. */
const TABLE = 4;

describe('buildPayrollWorkbook — «Resumen»', () => {
  it('opens with the period, its state and the method of the base salary (CA-17)', () => {
    const { summary } = build([line()], [item()]);

    expect(summary.slice(0, 3).map((row) => valueOf(row[0]))).toEqual(HEADING);
    expect(summary[0]![0]).toMatchObject({ fontWeight: 'bold' });
    expect(summary[3]).toEqual([null]);
  });

  it('then its columns (CA-17)', () => {
    const { summary } = build([line()], [item()]);

    expect(valuesOf(summary[TABLE])).toEqual([
      'Empleado',
      'Días activos',
      'Días del periodo',
      'Salario base mensual',
      'Salario base del periodo',
      'Comisión (%)',
      'Comisiones',
      'Total',
    ]);
  });

  it('writes one row per employee, values as numbers in pesos (CA-17, spec 016 CA-19)', () => {
    const { summary } = build([line()], [item()]);
    const row = summary[TABLE + 1];

    expect(valuesOf(row)).toEqual(['Paula Pineda', 15, 15, 1300000, 650000, 40, 48000, 698000]);
    expect(row![3]).toMatchObject({ type: Number, format: '"$" #,##0' });
    expect(row![7]).toMatchObject({ type: Number, format: '"$" #,##0' });
    expect(row![1]).toMatchObject({ type: Number });
  });

  it('ends with the total of the period under «Total»: 698 000 + 1 528 002 = 2 226 002 (CA-17)', () => {
    const { summary } = build(
      [line(), line({ employee_id: 'e2', employee_name: 'Elkin Estrada', total: 1528002 })],
      []
    );

    // heading (3) + blank + header + 2 employees + blank + total
    expect(summary).toHaveLength(TABLE + 5);
    const last = summary.at(-1)!;
    expect(valueOf(last[6])).toBe('Total del periodo');
    expect(last[7]).toMatchObject({ value: 2226002, type: Number, format: '"$" #,##0' });
  });
});

describe('buildPayrollWorkbook — «Detalle»', () => {
  it('writes each service of each employee, the date as the closing day in Colombia (spec 016, CA-19)', () => {
    const { detail } = build([line()], [item()]);

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

  it('keeps a commission with its cents, as it was computed (spec 016, CA-19)', () => {
    const { detail } = build([line()], [item({ commission: 10000.5, price: 33335 })]);

    expect(detail[1]![6]).toMatchObject({ value: 10000.5, type: Number, format: '"$" #,##0.00' });
  });
});

describe('payrollFileName', () => {
  it('names a closed fortnight by its month and half (CA-17)', () => {
    expect(payrollFileName({ kind: 'fortnight', start: '2026-11-01' }, 'closed')).toBe(
      'liquidacion-2026-11-1a-quincena.xlsx'
    );
    expect(payrollFileName({ kind: 'fortnight', start: '2026-11-16' }, 'closed')).toBe(
      'liquidacion-2026-11-2a-quincena.xlsx'
    );
  });

  it('says when a fortnight is still provisional (CA-17)', () => {
    expect(payrollFileName({ kind: 'fortnight', start: '2026-11-16' }, 'provisional')).toBe(
      'liquidacion-2026-11-2a-quincena-provisional.xlsx'
    );
  });

  it('names a range by its two days (CA-17)', () => {
    expect(payrollFileName({ kind: 'range', from: '2026-11-03', to: '2026-11-20' }, 'query')).toBe(
      'liquidacion-2026-11-03-a-2026-11-20.xlsx'
    );
  });
});
