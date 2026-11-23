import { createTranslator } from 'next-intl';
import type { NextRequest } from 'next/server';

import writeXlsxFile from 'write-excel-file/node';

import { DEFAULT_LOCALE, messages } from '@web/i18n/messages';
import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { getServiceReport } from '@web/modules/reports/api/reports.server';
import { reportFiltersSchema } from '@web/modules/reports/schemas/reports.schema';
import {
  WORKBOOK_COLUMNS,
  buildServicesWorkbook,
  workbookFileName,
} from '@web/modules/reports/utils/services-workbook.lib';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * The services report as an Excel file (spec 015, HU-02): every row of the same filters as the
 * screen, read from the address with the same schema (CA-12, RF-02). Only an active admin gets it,
 * checked here and again by the database functions (CA-14, RN-04).
 */
export const GET = async (request: NextRequest) => {
  const admin = await getActiveAdmin();
  if (!admin) return new Response(null, { status: 403 });

  const filters = reportFiltersSchema(todayIn(new Date())).parse(
    Object.fromEntries(request.nextUrl.searchParams)
  );
  // Every row: the Excel is never a page.
  const { rows, totals } = await getServiceReport({ ...filters, page: 1 }, { all: true });

  const t = createTranslator({ locale: DEFAULT_LOCALE, messages, namespace: 'reports.export' });
  const sheet = buildServicesWorkbook(rows, totals, {
    columns: {
      closedAt: t('columns.closedAt'),
      order: t('columns.order'),
      customer: t('columns.customer'),
      vehicle: t('columns.vehicle'),
      plate: t('columns.plate'),
      service: t('columns.service'),
      price: t('columns.price'),
      employees: t('columns.employees'),
    },
    totals: {
      services: t('totals.services'),
      subtotal: t('totals.subtotal'),
      discounts: t('totals.discounts'),
      total: t('totals.total'),
    },
  });
  const file = await writeXlsxFile(sheet, {
    sheet: t('sheet'),
    columns: WORKBOOK_COLUMNS,
    stickyRowsCount: 1,
  }).toBuffer();

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': XLSX,
      'Content-Disposition': `attachment; filename="${workbookFileName(filters.from, filters.to)}"`,
      // The business's figures: never in a shared cache.
      'Cache-Control': 'private, no-store',
    },
  });
};
