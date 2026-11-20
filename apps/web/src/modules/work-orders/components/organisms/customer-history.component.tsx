'use client';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

import { formatPesos } from '@web/modules/core/utils/money.utils';
import OrderStatusChip from '@web/modules/work-orders/components/atoms/order-status-chip.component';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

type CustomerHistoryProps = {
  /** Every order of the customer, newest first. */
  orders: WorkOrderSummary[];
  /** In «Nueva orden», the visits and the last two; on the record, every order (CA-16). */
  variant: 'summary' | 'full';
};

/** RN-07: a visit is a closed order that was not voided. */
const visitsOf = (orders: WorkOrderSummary[]) =>
  orders.filter((order) => order.status === 'closed');

/**
 * How many times a customer has come and what was done (spec 008, HU-03): the number of visits
 * and the last two (CA-15), or every order with its status on the record (CA-16); a customer
 * without visits is on their first one (CA-17).
 */
const CustomerHistory = ({ orders, variant }: CustomerHistoryProps) => {
  const t = useTranslations('orders');
  const format = useFormatter();
  const visits = visitsOf(orders);
  const shown = variant === 'summary' ? visits.slice(0, 2) : orders;
  const dateOf = (order: WorkOrderSummary) =>
    format.dateTime(new Date(order.closed_at ?? order.opened_at ?? 0), {
      dateStyle: 'medium',
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          {variant === 'summary' ? t('history.title') : t('history.all')}
        </h2>
        {visits.length > 0 && (
          <span className="text-sm text-default-500">
            {t('history.visits', { count: visits.length })}
          </span>
        )}
      </div>
      {variant === 'summary' && visits.length === 0 && (
        <p className="text-sm text-default-500">{t('history.firstVisit')}</p>
      )}
      {variant === 'full' && orders.length === 0 && (
        <p className="text-sm text-default-500">{t('history.empty')}</p>
      )}
      {shown.length > 0 && (
        <ul className="flex flex-col divide-y divide-divider rounded-medium border border-divider">
          {shown.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {t('number', { number: order.number ?? 0 })}
                  </Link>
                  <span className="text-xs text-default-500">{dateOf(order)}</span>
                  {variant === 'full' && order.status && <OrderStatusChip status={order.status} />}
                </span>
                <span className="text-xs text-default-500">
                  {vehicleLabel(
                    {
                      brand_name: order.brand_name,
                      line_name: order.line_name,
                      plate: order.plate,
                    },
                    t('picker.noPlate')
                  )}
                </span>
                <span className="text-xs text-default-500">
                  {(order.services ?? []).join(' · ')}
                </span>
              </span>
              <span className="tabular-nums">{formatPesos(order.total ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CustomerHistory;
