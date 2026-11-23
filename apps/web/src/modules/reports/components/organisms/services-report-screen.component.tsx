'use client';

import { Fragment } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { button } from '@heroui/theme';
import { ChevronRight, FileSpreadsheet } from 'lucide-react';

import { formatPesos } from '@web/modules/core/utils/money.utils';
import ReportFilters from '@web/modules/reports/components/molecules/report-filters.component';
import ReportsTabs from '@web/modules/reports/components/molecules/reports-tabs.component';
import { REPORT_PAGE_SIZE } from '@web/modules/reports/constants/reports.constants';
import type {
  ReportFilters as Filters,
  ReportEmployee,
  ReportPeriod,
  ServiceReportRow,
  ServiceReportTotals,
} from '@web/modules/reports/types/reports.types';
import {
  closingDay,
  employeesText,
  vehicleName,
} from '@web/modules/reports/utils/report-format.utils';
import { exportHref, reportHref } from '@web/modules/reports/utils/report-query.utils';
import { formatPlate } from '@web/modules/vehicles/utils/plate.utils';

type ServicesReportScreenProps = {
  filters: Filters;
  /** The services of this page, newest first. */
  rows: ServiceReportRow[];
  /** Of the whole filter, not only this page (CA-11). */
  totals: ServiceReportTotals;
  employees: ReportEmployee[];
  /** This month, to tell whether there are filters to remove (CA-08). */
  defaultPeriod: ReportPeriod;
};

const EMPTY =
  'flex flex-col items-center gap-3 rounded-large border border-dashed border-default-300 p-8 text-center text-sm text-default-500';
const CELL = 'px-4 py-3 align-top';

/**
 * «Reportes» → «Servicios» (spec 015): the services of the closed orders, for the admin. The
 * filters (CA-02 to CA-05), a table on the desktop and a card per service on a phone (both drawn,
 * the CSS shows one), each opening its order (CA-10); the totals of the whole filter (CA-06,
 * CA-11), its pages and «Exportar a Excel» with the same filters (CA-12).
 */
const ServicesReportScreen = ({
  filters,
  rows,
  totals,
  employees,
  defaultPeriod,
}: ServicesReportScreenProps) => {
  const t = useTranslations('reports.services');
  const pages = Math.max(1, Math.ceil(totals.services / REPORT_PAGE_SIZE));
  const isFiltered =
    filters.from !== defaultPeriod.from ||
    filters.to !== defaultPeriod.to ||
    filters.employee !== null ||
    filters.plate !== '';

  // The closing day in Colombia (RN-01), «30/11/2026».
  const dayOf = (row: ServiceReportRow) => closingDay(row.closed_at).split('-').reverse().join('/');
  const vehicleOf = (row: ServiceReportRow) =>
    `${vehicleName(row)} · ${row.plate ? formatPlate(row.plate) : t('noPlate')}`;
  const employeesOf = (row: ServiceReportRow) =>
    row.employees.length > 0 ? employeesText(row.employees) : t('noEmployees');

  const totalLines: [string, string][] = [
    [t('totals.services'), String(totals.services)],
    [t('totals.subtotal'), formatPesos(totals.subtotal)],
    ...(totals.discounts === null || totals.total === null
      ? []
      : ([
          [t('totals.discounts'), t('discount', { amount: formatPesos(totals.discounts) })],
          [t('totals.total'), formatPesos(totals.total)],
        ] as [string, string][])),
  ];

  return (
    <section className="flex flex-col gap-6">
      {/* Spec 016, RF-02: the other report of «Reportes», the payroll. */}
      <ReportsTabs current="services" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-default-500">{t('description')}</p>
        </div>
        {rows.length > 0 && (
          // A file, not a page: a real link (a «button» role would not say it goes anywhere).
          <a
            href={exportHref(filters)}
            download
            className={button({ variant: 'bordered', className: 'font-medium' })}
          >
            <FileSpreadsheet aria-hidden className="size-4" />
            {t('export')}
          </a>
        )}
      </div>

      <ReportFilters filters={filters} employees={employees} />

      {rows.length === 0 ? (
        <div className={EMPTY}>
          <p>{isFiltered ? t('emptyFiltered') : t('empty')}</p>
          {isFiltered && (
            <Link
              href={reportHref({ ...defaultPeriod, employee: null, plate: '', page: 1 })}
              className={button({ variant: 'ghost', size: 'sm' })}
            >
              {t('clearFilters')}
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: a table. */}
          <div className="hidden overflow-hidden rounded-large border border-divider bg-content1 shadow-small md:block">
            <table aria-label={t('tableLabel')} className="w-full text-left text-sm">
              <thead className="bg-default-50 text-xs text-default-500">
                <tr>
                  {(
                    [
                      'closedAt',
                      'order',
                      'customer',
                      'vehicle',
                      'service',
                      'price',
                      'employees',
                    ] as const
                  ).map((column) => (
                    <th
                      key={column}
                      scope="col"
                      className={`px-4 py-3 font-medium ${column === 'price' ? 'text-right' : ''}`}
                    >
                      {t(`columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {rows.map((row) => (
                  <tr key={row.line_id} className="hover:bg-default-50">
                    <td className={`${CELL} whitespace-nowrap tabular-nums`}>{dayOf(row)}</td>
                    <td className={CELL}>
                      <Link
                        href={`/orders/${row.order_id}`}
                        aria-label={t('openOrder', { number: row.order_number })}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {t('orderNumber', { number: row.order_number })}
                      </Link>
                    </td>
                    <td className={CELL}>{row.customer_name}</td>
                    <td className={CELL}>{vehicleOf(row)}</td>
                    <td className={CELL}>{row.service_name}</td>
                    <td className={`${CELL} text-right font-medium whitespace-nowrap tabular-nums`}>
                      {formatPesos(row.price)}
                    </td>
                    <td className={`${CELL} text-default-500`}>{employeesOf(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: a card per service, each opening its order. */}
          <ul
            aria-label={t('tableLabel')}
            className="flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small md:hidden"
          >
            {rows.map((row) => (
              <li key={row.line_id}>
                <Link
                  href={`/orders/${row.order_id}`}
                  className="flex items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{row.service_name}</span>
                    <span className="text-xs text-default-500">
                      {t('openOrder', { number: row.order_number })} · {row.customer_name}
                    </span>
                    <span className="text-xs text-default-500">{vehicleOf(row)}</span>
                    <span className="text-xs text-default-500">{employeesOf(row)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-medium tabular-nums">
                        {formatPesos(row.price)}
                      </span>
                      <span className="text-xs text-default-500 tabular-nums">{dayOf(row)}</span>
                    </span>
                    <ChevronRight aria-hidden className="size-4 text-default-400" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav
              aria-label={t('pagination.label')}
              className="flex items-center justify-between gap-2 text-sm"
            >
              {filters.page > 1 ? (
                <Link
                  href={reportHref({ ...filters, page: filters.page - 1 })}
                  className="underline-offset-4 hover:underline"
                >
                  {t('pagination.previous')}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-default-500">
                {t('pagination.page', { page: filters.page, pages })}
              </span>
              {filters.page < pages ? (
                <Link
                  href={reportHref({ ...filters, page: filters.page + 1 })}
                  className="underline-offset-4 hover:underline"
                >
                  {t('pagination.next')}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}

      {/* CA-06, CA-11: the totals of the whole filter, not only this page. */}
      <div className="flex flex-col items-end gap-2">
        <dl
          aria-label={t('totalsLabel')}
          className="grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm"
        >
          {totalLines.map(([label, value], index) => {
            const isTotal = index === totalLines.length - 1 && totalLines.length === 4;
            return (
              <Fragment key={label}>
                <dt className={isTotal ? 'font-semibold' : 'text-default-500'}>{label}</dt>
                <dd
                  className={`text-right tabular-nums ${isTotal ? 'font-semibold' : 'font-medium'}`}
                >
                  {value}
                </dd>
              </Fragment>
            );
          })}
        </dl>
        {totals.discounts === null && (
          <p className="max-w-xs text-right text-xs text-default-500">
            {t('noDiscountsWithEmployee')}
          </p>
        )}
      </div>
    </section>
  );
};

export default ServicesReportScreen;
