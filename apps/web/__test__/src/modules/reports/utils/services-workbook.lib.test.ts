/**
 * services-workbook.lib — the Excel file of the services report (spec 015, HU-02): what goes in
 * each cell. Writing the .xlsx itself is the library's job; the route only hands it these cells.
 *
 * Guards:
 * - CA-12: the same columns as the report, in its order, one row per service, and the totals at
 *   the end; the file is named by its period.
 * - CA-13: a date is a date and a value a number (Excel sorts and adds them), each with its format;
 *   the employees of a service and their share fit in one cell.
 * - CA-02, RN-01: the date of a service is the closing day in Colombia, not in UTC (an order closed
 *   at 11:30 p. m. on the 30th is on the 30th, though in UTC it is already the 1st).
 * - CA-06, RN-03: the discounts and the total only when the report has them (no employee filter).
 */
import type {
  ServiceReportRow,
  ServiceReportTotals,
} from '@web/modules/reports/types/reports.types';
import {
  type WorkbookLabels,
  buildServicesWorkbook,
  workbookFileName,
} from '@web/modules/reports/utils/services-workbook.lib';

const LABELS: WorkbookLabels = {
  columns: {
    closedAt: 'Fecha de cierre',
    order: 'Orden',
    customer: 'Cliente',
    vehicle: 'Vehículo',
    plate: 'Placa',
    service: 'Servicio',
    price: 'Valor',
    employees: 'Empleados',
  },
  totals: { services: 'Servicios', subtotal: 'Suma', discounts: 'Descuentos', total: 'Total' },
};

const row = (overrides: Partial<ServiceReportRow> = {}): ServiceReportRow => ({
  line_id: 'l1',
  order_id: 'o2',
  order_number: 2,
  closed_at: '2026-11-15T15:00:00-05:00',
  customer_name: 'Camila Cliente',
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
  service_name: 'Lavado detallado',
  price: 40000,
  employees: [
    { name: 'Elkin Estrada', share: 50 },
    { name: 'Paula Pineda', share: 50 },
  ],
  ...overrides,
});

const totals = (overrides: Partial<ServiceReportTotals> = {}): ServiceReportTotals => ({
  services: 1,
  subtotal: 40000,
  discounts: 5000,
  total: 35000,
  ...overrides,
});

/** The value of a cell, whether it is written plain or as an object with its type. */
const valueOf = (cell: unknown) =>
  cell !== null && typeof cell === 'object' && 'value' in cell ? cell.value : cell;

describe('buildServicesWorkbook', () => {
  it('starts with the columns of the report, in its order (CA-12)', () => {
    const [header] = buildServicesWorkbook([row()], totals(), LABELS);

    expect(header!.map(valueOf)).toEqual([
      'Fecha de cierre',
      'Orden',
      'Cliente',
      'Vehículo',
      'Placa',
      'Servicio',
      'Valor',
      'Empleados',
    ]);
  });

  it('writes one row per service with each of its fields (CA-12)', () => {
    const [, first] = buildServicesWorkbook([row()], totals(), LABELS);

    expect(first!.map(valueOf)).toEqual([
      new Date(Date.UTC(2026, 10, 15)),
      2,
      'Camila Cliente',
      'Suzuki GSX-R600',
      'UIH-03D',
      'Lavado detallado',
      40000,
      'Elkin Estrada 50 % · Paula Pineda 50 %',
    ]);
  });

  it('writes the date as a date and the value and order as numbers, each with its format (CA-13)', () => {
    const [, first] = buildServicesWorkbook([row()], totals(), LABELS);

    expect(first![0]).toMatchObject({ type: Date, format: 'dd/mm/yyyy' });
    expect(first![1]).toMatchObject({ type: Number });
    expect(first![6]).toMatchObject({ type: Number, format: '"$" #,##0' });
  });

  it('dates a service by its closing day in Colombia: 11:30 p. m. on the 30th is the 30th (RN-01)', () => {
    // 30 Nov 11:30 p. m. in Bogotá is 1 Dec 4:30 a. m. in UTC.
    const [, first] = buildServicesWorkbook(
      [row({ closed_at: '2026-12-01T04:30:00Z' })],
      totals(),
      LABELS
    );

    expect(valueOf(first![0])).toEqual(new Date(Date.UTC(2026, 10, 30)));
  });

  it('puts every employee and their share in one cell, and a single one at 100 % (CA-13)', () => {
    const [, , second] = buildServicesWorkbook(
      [row(), row({ line_id: 'l2', employees: [{ name: 'Diego Desactivado', share: 100 }] })],
      totals(),
      LABELS
    );

    expect(valueOf(second![7])).toBe('Diego Desactivado 100 %');
  });

  it('leaves the cells empty for a vehicle without line or plate, and a service without employees', () => {
    const [, first] = buildServicesWorkbook(
      [
        row({
          vehicle_type: 'bicycle',
          brand_name: 'Specialized',
          line_name: null,
          plate: null,
          employees: [],
        }),
      ],
      totals(),
      LABELS
    );

    expect([3, 4, 7].map((index) => valueOf(first![index]))).toEqual(['Specialized', null, null]);
  });

  it('ends, after a blank row, with how many, their sum, the discounts and the total, under «Valor» (CA-06, CA-12)', () => {
    const sheet = buildServicesWorkbook(
      [row(), row({ line_id: 'l2', price: 120000 })],
      totals({ services: 2, subtotal: 160000, discounts: 5000, total: 155000 }),
      LABELS
    );
    // 1 header + 2 services + 1 blank + 4 totals.
    expect(sheet).toHaveLength(8);
    expect(sheet[3]!.every((cell) => valueOf(cell) == null)).toBe(true);

    const lines = sheet.slice(4).map((cells) => [valueOf(cells[5]), valueOf(cells[6])]);
    expect(lines).toEqual([
      ['Servicios', 2],
      ['Suma', 160000],
      ['Descuentos', 5000],
      ['Total', 155000],
    ]);
    // A count is not money; the sums are.
    expect(sheet[4]![6]).not.toHaveProperty('format');
    expect(sheet[5]![6]).toMatchObject({ type: Number, format: '"$" #,##0' });
    expect(sheet[7]![6]).toMatchObject({ type: Number, format: '"$" #,##0' });
  });

  it('leaves out the discounts and the total when filtered by employee (CA-06, RN-03)', () => {
    const sheet = buildServicesWorkbook([row()], totals({ discounts: null, total: null }), LABELS);

    // header, the service, a blank row and the totals.
    expect(sheet.slice(2).map((cells) => valueOf(cells[5]) ?? null)).toEqual([
      null,
      'Servicios',
      'Suma',
    ]);
  });

  it('with no services, writes the columns and the totals at zero', () => {
    const sheet = buildServicesWorkbook(
      [],
      totals({ services: 0, subtotal: 0, discounts: 0, total: 0 }),
      LABELS
    );

    expect(sheet).toHaveLength(6); // header + blank + 4 totals
    expect(valueOf(sheet[2]![6])).toBe(0);
  });
});

describe('workbookFileName', () => {
  it('names the file by its period (CA-12)', () => {
    expect(workbookFileName('2026-11-01', '2026-11-23')).toBe(
      'servicios-2026-11-01-a-2026-11-23.xlsx'
    );
  });
});
