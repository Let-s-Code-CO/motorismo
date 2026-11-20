'use client';

import { useState } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, Button } from '@heroui/react';
import { ArrowLeft, Ban, FilePen, Pencil, Wallet } from 'lucide-react';

import { formatPesos } from '@web/modules/core/utils/money.utils';
import OrderStatusChip from '@web/modules/work-orders/components/atoms/order-status-chip.component';
import OrderEstimate from '@web/modules/work-orders/components/molecules/order-estimate.component';
import OrderSummary from '@web/modules/work-orders/components/molecules/order-summary.component';
import CloseOrderDialog from '@web/modules/work-orders/components/organisms/close-order-dialog.component';
import OrderEditor from '@web/modules/work-orders/components/organisms/order-editor.component';
import VoidOrderDialog from '@web/modules/work-orders/components/organisms/void-order-dialog.component';
import type { WorkOrderValues } from '@web/modules/work-orders/schemas/work-order.schema';
import type { WorkOrderDetail } from '@web/modules/work-orders/types/work-orders.types';
import { orderTotals } from '@web/modules/work-orders/utils/order-totals.utils';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

type OrderDetailProps = {
  order: WorkOrderDetail;
  isAdmin: boolean;
  /** What was just done, to announce it (after opening an order). */
  saved?: 'opened';
};

/**
 * One order (spec 008, CA-20): services with their employees and shares, totals, payments, who
 * received and handed it over and when. Open, staff edit, close or void it (CA-08, HU-02, CA-21);
 * closed, only an admin corrects or voids it (CA-22, CA-23, RN-05); voided, nothing more. A voided
 * or corrected order says by whom, when and why.
 */
const OrderDetail = ({ order, isAdmin, saved }: OrderDetailProps) => {
  const t = useTranslations('orders');
  const format = useFormatter();
  const router = useRouter();
  const { summary } = order;
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState<WorkOrderValues | null>(null);
  const [notice, setNotice] = useState<string | undefined>(
    saved === 'opened' ? t('editor.opened') : undefined
  );
  const isOpen = summary.status === 'open';
  const isClosed = summary.status === 'closed';
  const canVoid = isOpen || (isClosed && isAdmin);
  const busy = editing || correcting;
  const when = (date: string | null) =>
    date ? format.dateTime(new Date(date), { dateStyle: 'long', timeStyle: 'short' }) : '';

  return (
    <section className="flex flex-col gap-6">
      <Link
        href="/orders"
        className="flex w-max items-center gap-1 text-sm text-default-500 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('detail.back')}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {t('number', { number: summary.number ?? 0 })}
          </h1>
          {summary.status && <OrderStatusChip status={summary.status} />}
        </div>
        {!busy && (isOpen || canVoid || (isClosed && isAdmin)) && (
          <div className="flex flex-wrap gap-2">
            {canVoid && (
              <Button
                variant="light"
                className="text-danger-600 data-[hover=true]:bg-danger-50"
                startContent={<Ban aria-hidden className="size-4" />}
                onPress={() => {
                  setNotice(undefined);
                  setVoiding(true);
                }}
              >
                {t('detail.void')}
              </Button>
            )}
            {isClosed && isAdmin && (
              <Button
                variant="bordered"
                startContent={<FilePen aria-hidden className="size-4" />}
                onPress={() => {
                  setNotice(undefined);
                  setCorrecting(true);
                }}
              >
                {t('detail.correct')}
              </Button>
            )}
          </div>
        )}
        {isOpen && !busy && (
          <div className="flex gap-2">
            <Button
              variant="bordered"
              startContent={<Pencil aria-hidden className="size-4" />}
              onPress={() => {
                setNotice(undefined);
                setEditing(true);
              }}
            >
              {t('detail.edit')}
            </Button>
            <Button
              color="primary"
              className="font-medium"
              startContent={<Wallet aria-hidden className="size-4" />}
              onPress={() => {
                setNotice(undefined);
                setClosing(true);
              }}
            >
              {t('close.action')}
            </Button>
          </div>
        )}
      </div>

      {notice && <Alert color="success" variant="faded" title={notice} />}

      <div className="flex flex-col gap-4 rounded-large border border-divider bg-content1 p-5 text-sm shadow-small">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-default-500">{t('detail.customer')}</dt>
            <dd>
              <Link
                href={`/customers/${summary.customer_id}`}
                className="font-medium underline-offset-4 hover:underline"
              >
                {summary.customer_name}
              </Link>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-default-500">{t('detail.vehicle')}</dt>
            <dd className="font-medium">
              {vehicleLabel(
                {
                  brand_name: summary.brand_name,
                  line_name: summary.line_name,
                  plate: summary.plate,
                },
                t('picker.noPlate')
              )}
            </dd>
          </div>
        </dl>
        <p className="text-default-500">
          {t('detail.openedBy', {
            date: when(summary.opened_at),
            name: summary.opened_by_name ?? '',
          })}
          {summary.closed_at && (
            <>
              <br />
              {t('detail.closedBy', {
                date: when(summary.closed_at),
                name: summary.closed_by_name ?? '',
              })}
            </>
          )}
        </p>
        {summary.corrected_at && (
          <p className="text-default-500">
            {t('detail.correctedBy', {
              date: when(summary.corrected_at),
              name: summary.corrected_by_name ?? '',
              reason: summary.correction_reason ?? '',
            })}
          </p>
        )}
        {summary.voided_at && (
          <p className="font-medium text-danger-600">
            {t('detail.voidedBy', {
              date: when(summary.voided_at),
              name: summary.voided_by_name ?? '',
              reason: summary.void_reason ?? '',
            })}
          </p>
        )}
        {summary.notes && <p className="sm:col-span-2">{summary.notes}</p>}
      </div>

      {correcting ? (
        <OrderEditor
          customer={{ id: summary.customer_id ?? '', full_name: summary.customer_name ?? '' }}
          vehicle={{
            id: summary.vehicle_id ?? '',
            vehicle_type: summary.vehicle_type ?? 'motorcycle',
          }}
          order={order}
          onCancel={() => setCorrecting(false)}
          onSaved={() => undefined}
          onCorrect={setCorrection}
        />
      ) : editing ? (
        <OrderEditor
          customer={{ id: summary.customer_id ?? '', full_name: summary.customer_name ?? '' }}
          vehicle={{
            id: summary.vehicle_id ?? '',
            vehicle_type: summary.vehicle_type ?? 'motorcycle',
          }}
          order={order}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice(t('editor.updated'));
            router.refresh();
          }}
        />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-divider rounded-large border border-divider bg-content1 shadow-small">
            {order.lines.map((line) => (
              <li key={line.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{line.name}</span>
                  <span className="text-xs text-default-500">
                    {line.employees.length
                      ? line.employees
                          .map(({ full_name, share_pct }) =>
                            line.employees.length > 1 ? `${full_name} (${share_pct} %)` : full_name
                          )
                          .join(' · ')
                      : t('detail.noEmployees')}
                  </span>
                </span>
                <span className="tabular-nums">{formatPesos(line.price)}</span>
              </li>
            ))}
          </ul>
          <OrderSummary
            subtotal={summary.subtotal ?? 0}
            total={summary.total ?? 0}
            discount={
              <>
                <dt className="text-default-500">{t('summary.discount')}</dt>
                <dd className="tabular-nums">{formatPesos(summary.discount ?? 0)}</dd>
              </>
            }
            estimate={
              isOpen ? (
                <OrderEstimate lines={order.lines} receivedAt={new Date(summary.opened_at ?? 0)} />
              ) : undefined
            }
          />
          {summary.status === 'closed' && (
            <div className="flex flex-col gap-2 text-sm">
              <h2 className="font-semibold">{t('detail.payments')}</h2>
              {order.payments.length ? (
                <ul className="flex flex-col gap-1">
                  {order.payments.map((payment, index) => (
                    <li key={index} className="flex justify-between gap-4 tabular-nums">
                      <span>{t(`methods.${payment.method}`)}</span>
                      <span>{formatPesos(payment.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-default-500">{t('detail.noPayments')}</p>
              )}
            </div>
          )}
        </>
      )}

      {canVoid && (
        <VoidOrderDialog
          orderId={summary.id ?? ''}
          number={summary.number ?? 0}
          isOpen={voiding}
          onCancel={() => setVoiding(false)}
          onVoided={() => {
            setVoiding(false);
            setNotice(t('void.voided'));
            router.refresh();
          }}
        />
      )}
      {correction && (
        <CloseOrderDialog
          orderId={summary.id ?? ''}
          number={summary.number ?? 0}
          total={orderTotals(correction.lines, correction.discount).total}
          isOpen
          correction={{ values: correction, payments: order.payments }}
          onCancel={() => setCorrection(null)}
          onClosed={() => {
            setCorrection(null);
            setCorrecting(false);
            setNotice(t('correct.corrected'));
            router.refresh();
          }}
        />
      )}
      {isOpen && (
        <CloseOrderDialog
          orderId={summary.id ?? ''}
          number={summary.number ?? 0}
          total={summary.total ?? 0}
          isOpen={closing}
          onCancel={() => setClosing(false)}
          onClosed={() => {
            setClosing(false);
            setNotice(t('close.closed'));
            router.refresh();
          }}
        />
      )}
    </section>
  );
};

export default OrderDetail;
