'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { formatPesos } from '@web/modules/core/utils/money.utils';
import type {
  HistoryLine,
  HistoryOrder,
  HistoryPayment,
} from '@web/modules/customer-area/types/customer-area.types';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

/**
 * A closed order of the customer's history (spec 014, CA-07): date, vehicle, each service with its
 * value, the discount if any, the total and how it was paid. Nothing of who worked it.
 */
const HistoryOrderCard = ({ order }: { order: HistoryOrder }) => {
  const t = useTranslations('customerArea');
  const format = useFormatter();
  const lines = (order.lines ?? []) as HistoryLine[];
  const payments = (order.payments ?? []) as HistoryPayment[];
  const title = t('history.order', { number: order.number });

  return (
    <article
      aria-label={title}
      className="flex flex-col gap-3 rounded-large border border-divider bg-content1 p-5 shadow-small"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        <span className="text-sm text-default-500">
          {format.dateTime(new Date(order.closed_at), { dateStyle: 'long' })}
        </span>
      </div>
      <p className="text-sm text-default-600">{vehicleLabel(order, t('vehicle.noPlate'))}</p>

      <dl className="flex flex-col gap-1.5 border-t border-divider pt-3 text-sm">
        {lines.map((line, index) => (
          <div key={`${line.name}-${index}`} className="flex justify-between gap-3">
            <dt className="min-w-0">{line.name}</dt>
            <dd className="shrink-0 tabular-nums">{formatPesos(line.price)}</dd>
          </div>
        ))}
        {order.discount > 0 && (
          <>
            <div className="flex justify-between gap-3 text-default-500">
              <dt>{t('history.subtotal')}</dt>
              <dd className="tabular-nums">{formatPesos(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-3 text-default-500">
              <dt>{t('history.discount')}</dt>
              <dd className="tabular-nums">− {formatPesos(order.discount)}</dd>
            </div>
          </>
        )}
        <div className="flex justify-between gap-3 border-t border-divider pt-1.5 font-semibold">
          <dt>{t('history.total')}</dt>
          <dd className="tabular-nums">{formatPesos(order.total)}</dd>
        </div>
      </dl>

      {payments.length > 0 && (
        <p className="text-sm text-default-500">
          <span className="sr-only">{t('history.paid')}: </span>
          {payments
            .map(
              (payment) =>
                `${t(`history.methods.${payment.method}`)} ${formatPesos(payment.amount)}`
            )
            .join(' · ')}
        </p>
      )}
    </article>
  );
};

export default HistoryOrderCard;
