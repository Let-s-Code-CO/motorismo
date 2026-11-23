import { createTranslator } from 'next-intl';
import type { NextRequest } from 'next/server';

import writeXlsxFile from 'write-excel-file/node';

import { DEFAULT_LOCALE, messages } from '@web/i18n/messages';
import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import {
  getPayrollItems,
  getPayrollLines,
  getPayrollMonth,
} from '@web/modules/reports/api/payroll.server';
import { parsePayrollMonth } from '@web/modules/reports/utils/payroll-month.utils';
import {
  PAYROLL_DETAIL_COLUMNS,
  PAYROLL_SUMMARY_COLUMNS,
  buildPayrollWorkbook,
  payrollFileName,
} from '@web/modules/reports/utils/payroll-workbook.lib';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * A month's payroll as an Excel file (spec 016, HU-04): «Resumen» and «Detalle» of every employee
 * of the month of the address (CA-18). Only an active admin gets it, checked here and again by the
 * database functions (CA-20, RN-08).
 */
export const GET = async (request: NextRequest) => {
  const admin = await getActiveAdmin();
  if (!admin) return new Response(null, { status: 403 });

  const month = parsePayrollMonth(
    request.nextUrl.searchParams.get('month') ?? undefined,
    todayIn(new Date())
  );
  const [state, lines] = await Promise.all([getPayrollMonth(month), getPayrollLines(month)]);
  const items = (
    await Promise.all(
      lines.map(async (line) =>
        (await getPayrollItems(month, line.employee_id)).map((item) => ({
          ...item,
          employee_name: line.employee_name,
        }))
      )
    )
  ).flat();

  const t = createTranslator({
    locale: DEFAULT_LOCALE,
    messages,
    namespace: 'reports.payroll.sheet',
  });
  const { summary, detail } = buildPayrollWorkbook(lines, items, {
    summary: {
      employee: t('summaryColumns.employee'),
      activeDays: t('summaryColumns.activeDays'),
      monthDays: t('summaryColumns.monthDays'),
      baseSalary: t('summaryColumns.baseSalary'),
      basePay: t('summaryColumns.basePay'),
      commissionPct: t('summaryColumns.commissionPct'),
      commissions: t('summaryColumns.commissions'),
      total: t('summaryColumns.total'),
      monthTotal: t('summaryColumns.monthTotal'),
    },
    detail: {
      employee: t('detailColumns.employee'),
      closedAt: t('detailColumns.closedAt'),
      order: t('detailColumns.order'),
      service: t('detailColumns.service'),
      price: t('detailColumns.price'),
      share: t('detailColumns.share'),
      commission: t('detailColumns.commission'),
    },
  });
  const file = await writeXlsxFile([
    { data: summary, sheet: t('summary'), columns: PAYROLL_SUMMARY_COLUMNS, stickyRowsCount: 1 },
    { data: detail, sheet: t('detail'), columns: PAYROLL_DETAIL_COLUMNS, stickyRowsCount: 1 },
  ]).toBuffer();

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': XLSX,
      'Content-Disposition': `attachment; filename="${payrollFileName(month, state.status)}"`,
      // Salaries: never in a shared cache.
      'Cache-Control': 'private, no-store',
    },
  });
};
