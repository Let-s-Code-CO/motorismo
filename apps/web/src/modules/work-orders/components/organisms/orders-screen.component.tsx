'use client';

import { useFormatter, useNow, useTranslations } from 'next-intl';
import Link from 'next/link';

import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';

import { formatPesos } from '@web/modules/core/utils/money.utils';
import OrderStatusChip from '@web/modules/work-orders/components/atoms/order-status-chip.component';
import OrderEstimate from '@web/modules/work-orders/components/molecules/order-estimate.component';
import { CLOSED_PAGE_SIZE } from '@web/modules/work-orders/constants/work-orders.constants';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

type OrdersScreenProps = {
  /** «En el lavadero»: the open orders, oldest first (CA-18). */
  open: WorkOrderSummary[];
  /** One page of the closed and voided orders, newest first (CA-19). */
  closed: { rows: WorkOrderSummary[]; total: number };
  page: number;
};

/** The lines of an order as the estimate needs them: the view gives the sum and the missing ones. */
const estimateLines = (order: WorkOrderSummary) => [
  ...(order.estimated_minutes ? [{ name: '', estimated_minutes: order.estimated_minutes }] : []),
  ...(order.unestimated ?? []).map((name) => ({ name, estimated_minutes: null })),
];

/**
 * «Órdenes» (spec 008, HU-04): what is in the car wash now, with when each vehicle should be ready
 * (CA-18), and what was handed over, by pages, voided ones marked (CA-19).
 */
const OrdersScreen = ({ open, closed, page }: OrdersScreenProps) => {
  const t = useTranslations('orders');
  const format = useFormatter();
  // «Recibido hace …» counts from a shared «now», refreshed every minute.
  const now = useNow({ updateInterval: 60_000 });
  const pages = Math.max(1, Math.ceil(closed.total / CLOSED_PAGE_SIZE));
  const vehicleOf = (order: WorkOrderSummary) =>
    vehicleLabel(
      { brand_name: order.brand_name, line_name: order.line_name, plate: order.plate },
      t('picker.noPlate')
    );

  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-default-500">{t('description')}</p>
        </div>
        <Button
          as={Link}
          href="/orders/new"
          color="primary"
          className="font-medium"
          startContent={<Plus aria-hidden className="size-4" />}
        >
          {t('new')}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span aria-hidden className="size-2.5 rounded-full bg-warning-400" />
          {t('list.openTitle')}
        </h2>
        {open.length === 0 ? (
          <p className="rounded-medium border border-dashed border-default-300 p-4 text-center text-sm text-default-500">
            {t('list.openEmpty')}
          </p>
        ) : (
          <ul
            aria-label={t('list.label')}
            className="flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small"
          >
            {open.map((order) => (
              // In progress: an amber bar (state colours, CLAUDE.md); the section says it in words.
              <li key={order.id} className="border-l-4 border-l-warning-400">
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">
                      {t('number', { number: order.number ?? 0 })} · {order.customer_name}
                    </span>
                    <span className="text-xs text-default-500">{vehicleOf(order)}</span>
                    <span className="text-xs text-default-500">
                      {(order.services ?? []).join(' · ')}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5 text-sm">
                    <span className="font-medium tabular-nums">
                      {formatPesos(order.total ?? 0)}
                    </span>
                    <span className="text-xs text-default-500">
                      {t('list.receivedAgo', {
                        ago: format.relativeTime(new Date(order.opened_at ?? now), now),
                      })}
                    </span>
                    <OrderEstimate
                      lines={estimateLines(order)}
                      receivedAt={order.opened_at ? new Date(order.opened_at) : now}
                      compact
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span aria-hidden className="size-2.5 rounded-full bg-success-500" />
          {t('list.closedTitle')}
        </h2>
        {closed.rows.length === 0 ? (
          <p className="rounded-medium border border-dashed border-default-300 p-4 text-center text-sm text-default-500">
            {t('list.closedEmpty')}
          </p>
        ) : (
          <ul
            aria-label={t('list.closedLabel')}
            className="flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small"
          >
            {closed.rows.map((order) => (
              // Done: green; voided: grey (and its «Anulada» label, never colour alone).
              <li
                key={order.id}
                className={`border-l-4 ${order.status === 'voided' ? 'border-l-default-300' : 'border-l-success-500'}`}
              >
                <Link
                  href={`/orders/${order.id}`}
                  className="flex flex-wrap items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50"
                >
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {t('number', { number: order.number ?? 0 })} · {order.customer_name}
                      {order.status === 'voided' && <OrderStatusChip status="voided" />}
                    </span>
                    <span className="text-xs text-default-500">{vehicleOf(order)}</span>
                  </span>
                  <span className="flex flex-col items-end gap-0.5 text-sm">
                    <span
                      className={`tabular-nums ${order.status === 'voided' ? 'text-default-500 line-through' : 'font-medium'}`}
                    >
                      {formatPesos(order.total ?? 0)}
                    </span>
                    {order.closed_at && (
                      <span className="text-xs text-default-500">
                        {t('list.deliveredOn', {
                          date: format.dateTime(new Date(order.closed_at), { dateStyle: 'medium' }),
                        })}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <nav className="flex items-center justify-between gap-2 text-sm">
            {page > 1 ? (
              <Link
                href={`/orders?page=${page - 1}`}
                className="underline-offset-4 hover:underline"
              >
                {t('list.previous')}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-default-500">{t('list.page', { page })}</span>
            {page < pages ? (
              <Link
                href={`/orders?page=${page + 1}`}
                className="underline-offset-4 hover:underline"
              >
                {t('list.next')}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </section>
  );
};

export default OrdersScreen;
