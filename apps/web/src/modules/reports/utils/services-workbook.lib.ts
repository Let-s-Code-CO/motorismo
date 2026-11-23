import type { Cell, Row, SheetData } from 'write-excel-file/node';

import type {
  ServiceReportRow,
  ServiceReportTotals,
} from '@web/modules/reports/types/reports.types';
import {
  closingDay,
  employeesText,
  vehicleName,
} from '@web/modules/reports/utils/report-format.utils';
import { formatPlate } from '@web/modules/vehicles/utils/plate.utils';

/** The texts of the file, from `reports.export` (the route translates them). */
export type WorkbookLabels = {
  columns: Record<
    'closedAt' | 'order' | 'customer' | 'vehicle' | 'plate' | 'service' | 'price' | 'employees',
    string
  >;
  totals: Record<'services' | 'subtotal' | 'discounts' | 'total', string>;
};

/** Whole pesos, as Excel shows them in Spanish: «$ 25.000» (RN-05). */
const PESOS = '"$" #,##0';
const COLUMNS = 8;
/** Where the totals go: their name under «Servicio», the number under «Valor». */
const LABEL_COLUMN = 5;

/** A day as Excel keeps it: a date with no time zone, so it opens as that day anywhere. */
const excelDay = (day: string) => new Date(`${day}T00:00:00Z`);

const money = (value: number): Cell => ({ value, type: Number, format: PESOS });

const totalRow = (label: string, value: Cell): Row => {
  const cells: Row = Array.from({ length: COLUMNS }, () => null);
  cells[LABEL_COLUMN] = { value: label, fontWeight: 'bold' };
  cells[LABEL_COLUMN + 1] = value;
  return cells;
};

/**
 * The cells of the services report in Excel (spec 015, HU-02): the columns of the report, one row
 * per service (CA-12), dates as dates and values as numbers (CA-13), and after a blank row the
 * totals; discounts and total only when the report has them (CA-06, RN-03).
 */
export const buildServicesWorkbook = (
  rows: ServiceReportRow[],
  totals: ServiceReportTotals,
  { columns, totals: names }: WorkbookLabels
): SheetData => {
  const header: Row = [
    columns.closedAt,
    columns.order,
    columns.customer,
    columns.vehicle,
    columns.plate,
    columns.service,
    columns.price,
    columns.employees,
  ].map((value) => ({ value, fontWeight: 'bold' }));

  const services = rows.map((row): Row => [
    { value: excelDay(closingDay(row.closed_at)), type: Date, format: 'dd/mm/yyyy' },
    { value: row.order_number, type: Number },
    row.customer_name,
    vehicleName(row),
    row.plate ? formatPlate(row.plate) : null,
    row.service_name,
    money(row.price),
    row.employees.length > 0 ? employeesText(row.employees) : null,
  ]);

  return [
    header,
    ...services,
    Array.from({ length: COLUMNS }, () => null),
    totalRow(names.services, { value: totals.services, type: Number }),
    totalRow(names.subtotal, money(totals.subtotal)),
    ...(totals.discounts === null || totals.total === null
      ? []
      : [
          totalRow(names.discounts, money(totals.discounts)),
          totalRow(names.total, money(totals.total)),
        ]),
  ];
};

/** Widths of the columns, in characters, so the file opens readable. */
export const WORKBOOK_COLUMNS = [12, 8, 28, 24, 10, 26, 12, 44].map((width) => ({ width }));

/** «servicios-2026-11-01-a-2026-11-23.xlsx» (CA-12). */
export const workbookFileName = (from: string, to: string) => `servicios-${from}-a-${to}.xlsx`;
