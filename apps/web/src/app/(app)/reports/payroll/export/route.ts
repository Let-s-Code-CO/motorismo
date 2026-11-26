import { createTranslator } from 'next-intl';
import type { NextRequest } from 'next/server';

import writeXlsxFile from 'write-excel-file/node';

import { DEFAULT_LOCALE, messages } from '@web/i18n/messages';
import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import {
  getPayrollItems,
  getPayrollLines,
  getPayrollPeriod,
} from '@web/modules/reports/api/payroll.server';
import { periodName } from '@web/modules/reports/hooks/payroll-period-name.hook';
import { payrollQuerySchema } from '@web/modules/reports/schemas/reports.schema';
import {
  PAYROLL_DETAIL_COLUMNS,
  PAYROLL_SUMMARY_COLUMNS,
  buildPayrollWorkbook,
  payrollFileName,
} from '@web/modules/reports/utils/payroll-workbook.lib';
import { todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * A period's payroll as an Excel file (spec 020, CA-17; spec 016, HU-04): «Resumen» and «Detalle» of
 * every employee of the period and method of the address, with them written on top. Only an active
 * admin gets it, checked here and again by the database functions (spec 016, RN-08).
 */
export const GET = async (request: NextRequest) => {
  const admin = await getActiveAdmin();
  if (!admin) return new Response(null, { status: 403 });

  const search = request.nextUrl.searchParams;
  const query = payrollQuerySchema(todayIn(new Date())).parse({
    fortnight: search.get('fortnight') ?? undefined,
    from: search.get('from') ?? undefined,
    to: search.get('to') ?? undefined,
    base: search.get('base') ?? undefined,
  });
  const [state, lines] = await Promise.all([getPayrollPeriod(query), getPayrollLines(query)]);
  const items = (
    await Promise.all(
      lines.map(async (line) =>
        (await getPayrollItems(query, line.employee_id)).map((item) => ({
          ...item,
          employee_name: line.employee_name,
        }))
      )
    )
  ).flat();

  const payroll = createTranslator({
    locale: DEFAULT_LOCALE,
    messages,
    namespace: 'reports.payroll',
  });
  const t = createTranslator({
    locale: DEFAULT_LOCALE,
    messages,
    namespace: 'reports.payroll.sheet',
  });
  const heading = [
    t('title', { period: periodName(payroll, query.period) }),
    t('status', { status: state.status }),
    t('method', { method: payroll(`methods.${state.method}`) }),
  ];
  const { summary, detail } = buildPayrollWorkbook(
    lines,
    items,
    {
      summary: {
        employee: t('summaryColumns.employee'),
        activeDays: t('summaryColumns.activeDays'),
        periodDays: t('summaryColumns.periodDays'),
        baseSalary: t('summaryColumns.baseSalary'),
        basePay: t('summaryColumns.basePay'),
        commissionPct: t('summaryColumns.commissionPct'),
        commissions: t('summaryColumns.commissions'),
        total: t('summaryColumns.total'),
        periodTotal: t('summaryColumns.periodTotal'),
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
    },
    heading
  );
  const file = await writeXlsxFile([
    { data: summary, sheet: t('summary'), columns: PAYROLL_SUMMARY_COLUMNS, stickyRowsCount: 1 },
    { data: detail, sheet: t('detail'), columns: PAYROLL_DETAIL_COLUMNS, stickyRowsCount: 1 },
  ]).toBuffer();

  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': XLSX,
      'Content-Disposition': `attachment; filename="${payrollFileName(query.period, state.status)}"`,
      // Salaries: never in a shared cache.
      'Cache-Control': 'private, no-store',
    },
  });
};
