import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { ChevronLeft } from 'lucide-react';

import { formatPesos } from '@web/modules/core/utils/money.utils';
import usePeriodName from '@web/modules/reports/hooks/payroll-period-name.hook';
import type {
  PayrollBasePart,
  PayrollItem,
  PayrollLine,
  PayrollQuery,
  PayrollState,
} from '@web/modules/reports/types/reports.types';
import { payrollHref, rangeEnds } from '@web/modules/reports/utils/payroll-period.utils';
import { closingDay } from '@web/modules/reports/utils/report-format.utils';

type PayrollEmployeeDetailProps = {
  query: PayrollQuery;
  line: PayrollLine;
  /** How the base salary was reached: a fortnight (or part of one) each (CA-04). */
  parts: PayrollBasePart[];
  items: PayrollItem[];
  /** Provisional, closed or a query, and the method of its figures. */
  state: Pick<PayrollState, 'status' | 'method'>;
};

const STATUS_LABEL = { provisional: 'provisional', closed: 'closed', query: 'query' } as const;

/** A commission keeps its cents, as it was computed: «$ 10.000,5» (RN-05 rounds only the sum). */
const exact = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2, useGrouping: true });
const formatExact = (value: number) => `$ ${exact.format(value)}`;

/**
 * How an employee's payroll of a period was reached (spec 020, CA-04; spec 016, CA-11): the base
 * salary piece by piece, a fortnight or part of one each, with its days and count (RN-02); each
 * service with its order, day in Colombia, value, share and commission, with its count; and the
 * totals, as in the payroll (spec 016, RN-05).
 */
const PayrollEmployeeDetail = ({
  query,
  line,
  parts,
  items,
  state,
}: PayrollEmployeeDetailProps) => {
  const t = useTranslations('reports.payroll');
  const periodName = usePeriodName();

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={payrollHref(query)}
          className="inline-flex w-max items-center gap-1 text-sm text-default-600 underline-offset-4 hover:text-foreground hover:underline"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {t('detail.back')}
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{line.employee_name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-default-500">
            {t('detail.subtitle', { period: periodName(query.period) })}
            <span className="rounded-full border border-default-300 px-2 py-0.5 text-xs font-medium text-foreground">
              {t(STATUS_LABEL[state.status])}
            </span>
          </p>
          <p className="text-sm text-default-500">
            {t('calculatedWith', { method: t(`methods.${state.method}`) })}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-large border border-divider bg-content1 p-4 shadow-small">
        <h2 className="text-base font-semibold tracking-tight">{t('detail.baseTitle')}</h2>
        <ul aria-label={t('detail.baseTitle')} className="flex flex-col gap-3">
          {parts.map((part) => (
            <li key={part.part_from} className="flex flex-col gap-0.5 text-sm tabular-figures">
              <span className="text-default-500">
                {t('detail.partDays', {
                  days: t('range', rangeEnds(part.part_from, part.part_to)),
                  active: part.active_days,
                  total: part.part_days,
                })}
              </span>
              <span className="text-default-700">
                {t('detail.partAmount', {
                  paid: part.paid_days,
                  divisor: part.divisor,
                  salary: formatPesos(line.base_salary),
                  amount: formatExact(part.amount),
                })}
              </span>
              {/* CA-14: by «Mes comercial» a whole fortnight is 15 days, whatever its length. */}
              {state.method === 'commercial' && part.paid_days !== part.active_days && (
                <span className="text-xs text-default-500">{t('detail.wholeFortnight')}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold tracking-tight">
          {t('detail.commissionsTitle', { pct: line.commission_pct })}
        </h2>
        {items.length === 0 ? (
          <p className="rounded-medium border border-dashed border-default-300 p-4 text-center text-sm text-default-500">
            {t('detail.none')}
          </p>
        ) : (
          <ul
            aria-label={t('detail.commissionsLabel')}
            className="flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small"
          >
            {items.map((item, index) => (
              <li
                key={`${item.order_id}-${index}`}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 p-4"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{item.service_name}</span>
                  <span className="text-xs text-default-500">
                    <Link
                      href={`/orders/${item.order_id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {t('detail.order', { number: item.order_number })}
                    </Link>{' '}
                    · {closingDay(item.closed_at).split('-').reverse().join('/')}
                  </span>
                </span>
                <span className="text-sm text-default-600 tabular-figures">
                  {t('detail.count', {
                    price: formatPesos(item.price),
                    share: item.share_pct,
                    pct: line.commission_pct,
                    commission: formatExact(item.commission),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <dl
        aria-label={t('detail.totalsLabel', { name: line.employee_name })}
        className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm"
      >
        <dt className="text-default-500">{t('detail.basePay')}</dt>
        <dd className="text-right font-medium tabular-nums">{formatPesos(line.base_pay)}</dd>
        <dt className="text-default-500">{t('detail.commissions')}</dt>
        <dd className="text-right font-medium tabular-nums">{formatPesos(line.commissions)}</dd>
        <dt className="font-semibold">{t('detail.total')}</dt>
        <dd className="text-right font-semibold tabular-nums">{formatPesos(line.total)}</dd>
      </dl>
    </section>
  );
};

export default PayrollEmployeeDetail;
