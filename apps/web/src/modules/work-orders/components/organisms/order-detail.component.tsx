'use client';

import { useState } from 'react';

import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, Button } from '@heroui/react';
import {
  ArrowLeft,
  Ban,
  Bike,
  CarFront,
  CircleCheck,
  FilePen,
  Inbox,
  type LucideIcon,
  Motorbike,
  NotebookPen,
  Pencil,
  Play,
  UserRound,
  Wallet,
} from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import { formatPesos } from '@web/modules/core/utils/money.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';
import { startWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import OrderStatusChip from '@web/modules/work-orders/components/atoms/order-status-chip.component';
import OrderEstimate from '@web/modules/work-orders/components/molecules/order-estimate.component';
import OrderSummary from '@web/modules/work-orders/components/molecules/order-summary.component';
import CloseOrderDialog from '@web/modules/work-orders/components/organisms/close-order-dialog.component';
import OrderEditor from '@web/modules/work-orders/components/organisms/order-editor.component';
import VoidOrderDialog from '@web/modules/work-orders/components/organisms/void-order-dialog.component';
import type { WorkOrderValues } from '@web/modules/work-orders/schemas/work-order.schema';
import type { WorkOrderDetail } from '@web/modules/work-orders/types/work-orders.types';
import { orderStage } from '@web/modules/work-orders/utils/order-status.utils';
import { orderTotals } from '@web/modules/work-orders/utils/order-totals.utils';

const VEHICLE_ICONS: Record<string, LucideIcon> = {
  motorcycle: Motorbike,
  bicycle: Bike,
  car: CarFront,
};

/** One step of the order's history («Recibido el … por …»), with its icon. */
const HistoryLine = ({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) => (
  <li className={`flex items-start gap-2 ${className ?? ''}`}>
    <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
    <span>{children}</span>
  </li>
);

type OrderDetailProps = {
  order: WorkOrderDetail;
  isAdmin: boolean;
  /** What was just done, to announce it (after opening an order). */
  saved?: 'opened';
};

/**
 * One order (spec 008, CA-20): services with their employees and shares, totals, payments, who
 * received, started and handed it over and when. In the queue, staff start it (CA-33); open, they
 * edit, close or void it (CA-08, HU-02, CA-21);
 * closed, only an admin corrects or voids it (CA-22, CA-23, RN-05); voided, nothing more. A voided
 * or corrected order says by whom, when and why.
 */
const OrderDetail = ({ order, isAdmin, saved }: OrderDetailProps) => {
  const t = useTranslations('orders');
  const tVehicles = useTranslations('vehicles');
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
  const stage = orderStage(summary);
  const VehicleIcon = VEHICLE_ICONS[summary.vehicle_type ?? ''] ?? Motorbike;
  const [starting, setStarting] = useState(false);
  const start = async () => {
    setNotice(undefined);
    setStarting(true);
    const result = await callAction(() => startWorkOrder({ id: summary.id ?? '' }));
    setStarting(false);
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    setNotice(result.ok ? t('detail.started') : t(`errors.${result.error}`));
    router.refresh();
  };
  const isClosed = summary.status === 'closed';
  const canVoid = isOpen || (isClosed && isAdmin);
  const busy = editing || correcting;
  const clock = useClock();
  // Date and time apart: Node and the browser join them differently («, » / « a las »), which would
  // break hydration; the time on a 12-hour clock like the rest of the app.
  const when = (date: string | null) =>
    date
      ? {
          date: format.dateTime(new Date(date), { dateStyle: 'long' }),
          time: clock(new Date(date)),
        }
      : { date: '', time: '' };

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
          <OrderStatusChip stage={stage} />
        </div>
        {!busy && isClosed && isAdmin && (
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
        {isOpen && !busy && (
          <div className="flex flex-wrap gap-2">
            {stage === 'queued' && (
              <Button
                variant="bordered"
                startContent={<Play aria-hidden className="size-4" />}
                isLoading={starting}
                onPress={start}
              >
                {t('detail.start')}
              </Button>
            )}
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

      {/*
       * The order's card, in three bands: what came in and whose it is (the vehicle with its plate,
       * as on the customer record), its history (one line per step, each with its icon) and the
       * notes. The same layout on a phone: the plate stays beside the name.
       */}
      <div className="flex flex-col divide-y divide-divider rounded-large border border-divider bg-content1 text-sm shadow-small">
        <div className="flex items-center gap-3 p-4 sm:p-5">
          {/* The type at a glance (moto, carro, bici); named for screen readers. */}
          <span
            role="img"
            aria-label={
              summary.vehicle_type ? tVehicles(`types.${summary.vehicle_type}`) : undefined
            }
            className="flex size-10 shrink-0 items-center justify-center rounded-medium bg-default-100 text-default-600"
          >
            <VehicleIcon aria-hidden className="size-5" />
          </span>
          <dl className="flex min-w-0 flex-1 flex-col gap-0.5">
            <dt className="sr-only">{t('detail.vehicle')}</dt>
            <dd className="truncate text-base font-medium">
              {[summary.brand_name, summary.line_name].filter(Boolean).join(' ')}
            </dd>
            <dt className="sr-only">{t('detail.customer')}</dt>
            <dd className="flex min-w-0 items-center gap-1.5 text-default-500">
              <UserRound aria-hidden className="size-4 shrink-0" />
              <Link
                href={`/customers/${summary.customer_id}`}
                className="cursor-pointer truncate underline-offset-4 hover:text-foreground hover:underline"
              >
                {summary.customer_name}
              </Link>
            </dd>
          </dl>
          {/* The plate drawn like a Colombian one, as on the customer record (spec 005). */}
          {summary.plate ? (
            <PlateLabel plate={summary.plate} city={summary.plate_city_name} className="shrink-0" />
          ) : (
            <span className="shrink-0 whitespace-nowrap text-default-500">
              {t('picker.noPlate')}
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-2 p-4 text-default-500 sm:p-5">
          <HistoryLine icon={Inbox}>
            {t('detail.openedBy', {
              ...when(summary.opened_at),
              name: summary.opened_by_name ?? '',
            })}
          </HistoryLine>
          {summary.started_at && (
            <HistoryLine icon={Play}>
              {t('detail.startedBy', {
                ...when(summary.started_at),
                name: summary.started_by_name ?? '',
              })}
            </HistoryLine>
          )}
          {summary.closed_at && (
            <HistoryLine icon={CircleCheck}>
              {t('detail.closedBy', {
                ...when(summary.closed_at),
                name: summary.closed_by_name ?? '',
              })}
            </HistoryLine>
          )}
          {summary.corrected_at && (
            <HistoryLine icon={FilePen}>
              {t('detail.correctedBy', {
                ...when(summary.corrected_at),
                name: summary.corrected_by_name ?? '',
                reason: summary.correction_reason ?? '',
              })}
            </HistoryLine>
          )}
          {summary.voided_at && (
            <HistoryLine icon={Ban} className="font-medium text-danger-600">
              {t('detail.voidedBy', {
                ...when(summary.voided_at),
                name: summary.voided_by_name ?? '',
                reason: summary.void_reason ?? '',
              })}
            </HistoryLine>
          )}
        </ul>

        {summary.notes && (
          // Labelled like the rest of the order, so it reads as the order's notes.
          <dl className="flex flex-col gap-1 p-4 sm:p-5">
            <dt className="flex items-center gap-1.5 text-default-500">
              <NotebookPen aria-hidden className="size-4" />
              {t('editor.notes')}
            </dt>
            <dd className="whitespace-pre-line">{summary.notes}</dd>
          </dl>
        )}
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
                <OrderEstimate
                  lines={order.lines}
                  startedAt={summary.started_at ? new Date(summary.started_at) : null}
                />
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

      {/*
       * Voiding lives at the end, in its own section, like «Desactivar cliente» on the customer
       * record: away from the day-to-day actions at the top, so nobody voids by mistake, and a solid
       * red button because it is destructive. danger-600, not danger-500: white text on it keeps AA.
       */}
      {canVoid && !busy && (
        <section
          aria-labelledby="void-order-title"
          className="flex flex-wrap items-center justify-between gap-4 rounded-large border border-divider bg-content1 p-5 shadow-small"
        >
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="void-order-title" className="text-sm font-semibold">
              {t('detail.voidTitle')}
            </h2>
            <p className="text-sm text-default-500">{t('void.description')}</p>
          </div>
          <Button
            color="danger"
            variant="solid"
            className="bg-danger-600 font-medium data-[hover=true]:bg-danger-700"
            startContent={<Ban aria-hidden className="size-4" />}
            onPress={() => {
              setNotice(undefined);
              setVoiding(true);
            }}
          >
            {t('detail.void')}
          </Button>
        </section>
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
