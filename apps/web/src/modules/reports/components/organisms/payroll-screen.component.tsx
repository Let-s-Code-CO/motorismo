'use client';

import { useState, useTransition } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@heroui/react';
import { button } from '@heroui/theme';
import { ChevronLeft, ChevronRight, FileSpreadsheet, TriangleAlert } from 'lucide-react';

import ConfirmDialog from '@web/modules/core/components/confirm-dialog.component';
import useClock from '@web/modules/core/hooks/clock.hook';
import { notify } from '@web/modules/core/lib/toast.lib';
import { formatPesos } from '@web/modules/core/utils/money.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { closePayroll, regeneratePayroll } from '@web/modules/reports/actions/payroll.actions';
import ReportsTabs from '@web/modules/reports/components/molecules/reports-tabs.component';
import type { PayrollLine, PayrollMonth } from '@web/modules/reports/types/reports.types';
import {
  monthLabel,
  nextMonth,
  payrollEmployeeHref,
  payrollExportHref,
  payrollHref,
  previousMonth,
} from '@web/modules/reports/utils/payroll-month.utils';

type PayrollScreenProps = {
  /** `YYYY-MM`. */
  month: string;
  /** The month in progress, `YYYY-MM`: «Mes siguiente» stops there. */
  currentMonth: string;
  state: PayrollMonth;
  lines: PayrollLine[];
};

const CELL = 'px-4 py-3 align-top';
const NAV_LINK =
  'inline-flex items-center gap-1 rounded-small text-sm text-default-600 underline-offset-4 hover:text-foreground hover:underline';

/**
 * «Reportes» → «Liquidación» (spec 016): what each employee earns in a month. The month and how
 * to move between months (CA-05); whether it is provisional or closed, by whom and when, and
 * whether something changed since (CA-12, CA-15 to CA-17); a table on the desktop and a card per
 * employee on a phone, each opening the detail (CA-11); the total of the month; «Cerrar
 * liquidación» or «Regenerar», asked first (CA-14, CA-16); «Exportar a Excel» (CA-18).
 */
const PayrollScreen = ({ month, currentMonth, state, lines }: PayrollScreenProps) => {
  const t = useTranslations('reports.payroll');
  const format = useFormatter();
  const clock = useClock();
  const router = useRouter();
  const [asking, setAsking] = useState<'close' | 'regenerate' | null>(null);
  const [isPending, startTransition] = useTransition();
  const label = monthLabel(month);
  const inSentence = label.toLowerCase();
  const next = nextMonth(month, `${currentMonth}-01`);

  const when = (iso: string) => ({
    date: format.dateTime(new Date(iso), { dateStyle: 'long' }),
    time: clock(new Date(iso)),
  });

  const run = (action: 'close' | 'regenerate') =>
    startTransition(async () => {
      const result = await callAction(() =>
        action === 'close' ? closePayroll({ month }) : regeneratePayroll({ month })
      );
      setAsking(null);
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      // Spec 013: a floating notice; a refusal stays until closed.
      notify(
        result.ok
          ? {
              tone: 'success',
              text: t(action === 'close' ? 'closedNotice' : 'regeneratedNotice', {
                month: inSentence,
              }),
            }
          : { tone: 'danger', text: t(`errors.${result.error}`) }
      );
      router.refresh();
    });

  const isClosed = state.status === 'closed';

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ReportsTabs current="payroll" />
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-default-500">{t('description')}</p>
        </div>
      </div>

      {/* The month and its neighbours (CA-05). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* On a phone the month on top and its neighbours under it, one on each side; from `sm`,
            all in a row («‹ Mes anterior  Octubre de 2026  Mes siguiente ›»). */}
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <h2 className="text-xl font-semibold tracking-tight sm:order-2">{label}</h2>
          <div className="flex items-center justify-between sm:contents">
            <Link href={payrollHref(previousMonth(month))} className={`${NAV_LINK} sm:order-1`}>
              <ChevronLeft aria-hidden className="size-4" />
              {t('previousMonth')}
            </Link>
            {next && (
              <Link href={payrollHref(next)} className={`${NAV_LINK} sm:order-3`}>
                {t('nextMonth')}
                <ChevronRight aria-hidden className="size-4" />
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {lines.length > 0 && (
            // A file, not a page: a real link that downloads it.
            <a
              href={payrollExportHref(month)}
              download
              className={button({ variant: 'bordered', className: 'font-medium' })}
            >
              <FileSpreadsheet aria-hidden className="size-4" />
              {t('export')}
            </a>
          )}
          {state.can_close && (
            <Button color="primary" className="font-medium" onPress={() => setAsking('close')}>
              {t('close')}
            </Button>
          )}
          {isClosed && (
            <Button
              variant="bordered"
              className="font-medium"
              onPress={() => setAsking('regenerate')}
            >
              {t('regenerate')}
            </Button>
          )}
        </div>
      </div>

      {/* Its state (CA-12, CA-15 to CA-17). */}
      <div className="flex flex-col gap-2 text-sm">
        {isClosed ? (
          <>
            {state.closed_at && (
              <p className="text-default-600">
                {t('closedBy', { ...when(state.closed_at), name: state.closed_by_name ?? '' })}
              </p>
            )}
            {state.regenerated_at && (
              <p className="text-default-600">
                {t('regeneratedBy', {
                  ...when(state.regenerated_at),
                  name: state.regenerated_by_name ?? '',
                  total: formatPesos(state.previous_total ?? 0),
                })}
              </p>
            )}
            {state.changed_since_close && (
              <p className="flex items-start gap-2 rounded-medium border border-warning-300 bg-warning-50 px-3 py-2 text-foreground dark:border-warning-200/40 dark:bg-warning-50/10">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {t('changed')}
              </p>
            )}
          </>
        ) : (
          <p className="flex flex-wrap items-center gap-2 text-default-600">
            <span className="rounded-full border border-default-300 px-2 py-0.5 text-xs font-medium text-foreground">
              {t('provisional')}
            </span>
            {t('provisionalText')}
          </p>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="rounded-large border border-dashed border-default-300 p-8 text-center text-sm text-default-500">
          {t('empty')}
        </p>
      ) : (
        <>
          {/* Desktop: a table. */}
          <div className="hidden overflow-hidden rounded-large border border-divider bg-content1 shadow-small md:block">
            <table aria-label={t('tableLabel')} className="w-full text-left text-sm">
              <thead className="bg-default-50 text-xs text-default-500">
                <tr>
                  {(['employee', 'activeDays', 'basePay', 'commissions', 'total'] as const).map(
                    (column) => (
                      <th
                        key={column}
                        scope="col"
                        className={`px-4 py-3 font-medium ${column === 'employee' ? '' : 'text-right'}`}
                      >
                        {t(`columns.${column}`)}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {lines.map((line) => (
                  <tr key={line.employee_id} className="relative hover:bg-default-50">
                    <td className={CELL}>
                      <Link
                        href={payrollEmployeeHref(month, line.employee_id)}
                        // The whole row opens it: the link stretches over the row (after:inset-0).
                        className="font-medium underline-offset-4 outline-none after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
                      >
                        {line.employee_name}
                      </Link>
                    </td>
                    <td className={`${CELL} text-right tabular-nums`}>
                      {t('days', { active: line.active_days, month: line.month_days })}
                    </td>
                    <td className={`${CELL} text-right tabular-nums`}>
                      {formatPesos(line.base_pay)}
                    </td>
                    <td className={`${CELL} text-right tabular-nums`}>
                      {formatPesos(line.commissions)}
                    </td>
                    <td className={`${CELL} text-right font-medium tabular-nums`}>
                      {formatPesos(line.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: a card per employee, each opening the detail. */}
          <ul
            aria-label={t('tableLabel')}
            className="flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small md:hidden"
          >
            {lines.map((line) => (
              <li key={line.employee_id}>
                <Link
                  href={payrollEmployeeHref(month, line.employee_id)}
                  className="flex items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">{line.employee_name}</span>
                    <span className="text-xs text-default-500">
                      {t('columns.activeDays')}:{' '}
                      {t('days', { active: line.active_days, month: line.month_days })}
                    </span>
                    <span className="text-xs text-default-500">
                      {t('columns.basePay')}: {formatPesos(line.base_pay)} ·{' '}
                      {t('columns.commissions')}: {formatPesos(line.commissions)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-medium tabular-nums">
                      {formatPesos(line.total)}
                    </span>
                    <ChevronRight aria-hidden className="size-4 text-default-400" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 text-sm">
            <dt className="font-semibold">{t('monthTotal')}</dt>
            <dd className="text-right font-semibold tabular-nums">{formatPesos(state.total)}</dd>
          </dl>
        </>
      )}

      <ConfirmDialog
        isOpen={asking !== null}
        title={t(asking === 'regenerate' ? 'regenerateTitle' : 'closeTitle', { month: inSentence })}
        description={t(asking === 'regenerate' ? 'regenerateText' : 'closeText')}
        confirmLabel={t(asking === 'regenerate' ? 'regenerate' : 'close')}
        isPending={isPending}
        onConfirm={() => asking && run(asking)}
        onCancel={() => setAsking(null)}
      />
    </section>
  );
};

export default PayrollScreen;
