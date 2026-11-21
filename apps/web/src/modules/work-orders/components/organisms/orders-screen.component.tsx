'use client';

import { type ReactNode, useState, useTransition } from 'react';

import { useFormatter, useNow, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Alert, Button } from '@heroui/react';
import { CalendarClock, Play, Plus, Timer } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import { formatPesos } from '@web/modules/core/utils/money.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { extendReservationTolerance } from '@web/modules/reservations/actions/reservations.actions';
import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import { startWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import OrderStatusChip from '@web/modules/work-orders/components/atoms/order-status-chip.component';
import OrderEstimate from '@web/modules/work-orders/components/molecules/order-estimate.component';
import { CLOSED_PAGE_SIZE } from '@web/modules/work-orders/constants/work-orders.constants';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';
import { queueOf, reservationStanding } from '@web/modules/work-orders/utils/queue.utils';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

type OrdersScreenProps = {
  /** The open orders, oldest first: split into «En proceso» and «En cola» (CA-18). */
  open: WorkOrderSummary[];
  /** One page of the closed and voided orders, newest first (CA-19). */
  closed: { rows: WorkOrderSummary[]; total: number };
  page: number;
  /** Reservations whose time has come, customer not arrived yet (spec 012, CA-18). */
  arriving?: ReservationSummary[];
};

type Notice = { tone: 'success' | 'danger'; text: string };

/** The lines of an order as the estimate needs them: the view gives the sum and the missing ones. */
const estimateLines = (order: WorkOrderSummary) => [
  ...(order.estimated_minutes ? [{ name: '', estimated_minutes: order.estimated_minutes }] : []),
  ...(order.unestimated ?? []).map((name) => ({ name, estimated_minutes: null })),
];

const LIST =
  'flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small';
const EMPTY =
  'rounded-medium border border-dashed border-default-300 p-4 text-center text-sm text-default-500';
const ROW_LINK =
  'flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50';

/**
 * Spec 012: what came from a reservation, in the monochrome system (no new colour). Solid while the
 * reservation gives it its turn (on its way, or arrived on time); only outlined when it came late or
 * early and goes by its arrival, like anyone (RN-04).
 */
const ReservedTag = ({
  children,
  outlined = false,
}: {
  children: ReactNode;
  outlined?: boolean;
}) => (
  <span
    className={`inline-flex w-max items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
      outlined ? 'border border-default-400 text-default-700' : 'bg-foreground text-background'
    }`}
  >
    <CalendarClock aria-hidden className="size-3.5" />
    {children}
  </span>
);

const RESERVED_TEXT = {
  kept: 'list.reserved',
  late: 'list.reservedLate',
  early: 'list.reservedEarly',
} as const;

/** A section title with its state colour (CLAUDE.md: state colours only), said in words too. */
const SectionTitle = ({ dot, children }: { dot: string; children: ReactNode }) => (
  <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
    <span aria-hidden className={`size-2.5 rounded-full ${dot}`} />
    {children}
  </h2>
);

/**
 * «Órdenes» (spec 008, HU-04, HU-07): what is being done now, with when each vehicle should be
 * ready from its start (CA-18, CA-34); what waits its turn, by arrival, to start with one tap
 * (CA-33); and what was handed over, by pages, voided ones marked (CA-19).
 */
const OrdersScreen = ({ open, closed, page, arriving = [] }: OrdersScreenProps) => {
  const t = useTranslations('orders');
  const tReservations = useTranslations('reservations');
  const format = useFormatter();
  const router = useRouter();
  // «hace …» counts from a shared «now», refreshed every minute.
  // Every 30 s: «hace …», the countdown of a reservation on its way (spec 012, CA-33) and when it
  // leaves the queue.
  const now = useNow({ updateInterval: 30_000 });
  const [notice, setNotice] = useState<Notice>();
  const [isPending, startTransition] = useTransition();
  const pages = Math.max(1, Math.ceil(closed.total / CLOSED_PAGE_SIZE));
  const inProgress = open.filter((order) => order.started_at);
  const queue = open.filter((order) => !order.started_at);
  // Spec 012, RN-04: by turn, a reservation first on the same turn, with those on their way.
  const entries = queueOf(queue, arriving, now);
  const clock = useClock();

  const vehicleOf = (order: WorkOrderSummary) =>
    vehicleLabel(
      { brand_name: order.brand_name, line_name: order.line_name, plate: order.plate },
      t('picker.noPlate')
    );
  const ago = (date: string | null) => format.relativeTime(date ? new Date(date) : now, now);

  // Spec 012, CA-34: 5 more minutes for a customer on their way.
  const extend = (reservation: ReservationSummary) =>
    startTransition(async () => {
      const result = await callAction(() => extendReservationTolerance({ id: reservation.id }));
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      setNotice(
        result.ok
          ? {
              tone: 'success',
              text: t('list.extended', {
                name: reservation.customer_name ?? '',
                time: clock(
                  new Date(
                    new Date(reservation.slot_start ?? now).getTime() + result.minutes * 60_000
                  )
                ),
              }),
            }
          : { tone: 'danger', text: tReservations(`errors.${result.error}`) }
      );
      router.refresh();
    });

  const start = (order: WorkOrderSummary) =>
    startTransition(async () => {
      const result = await callAction(() => startWorkOrder({ id: order.id }));
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      setNotice(
        result.ok
          ? { tone: 'success', text: t('list.started', { number: order.number ?? 0 }) }
          : { tone: 'danger', text: t(`errors.${result.error}`) }
      );
      router.refresh();
    });

  const heading = (order: WorkOrderSummary) => (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="font-medium">
        {t('number', { number: order.number ?? 0 })} · {order.customer_name}
      </span>
      <span className="text-xs text-default-500">{vehicleOf(order)}</span>
      <span className="text-xs text-default-500">{(order.services ?? []).join(' · ')}</span>
    </span>
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

      {notice && <Alert color={notice.tone} variant="faded" title={notice.text} />}

      <div className="flex flex-col gap-3">
        <SectionTitle dot="bg-warning-400">{t('list.inProgressTitle')}</SectionTitle>
        {inProgress.length === 0 ? (
          <p className={EMPTY}>{t('list.inProgressEmpty')}</p>
        ) : (
          <ul aria-label={t('list.inProgressLabel')} className={LIST}>
            {inProgress.map((order) => {
              const times = (
                <>
                  <span>{t('list.startedAgo', { ago: ago(order.started_at) })}</span>
                  <OrderEstimate
                    lines={estimateLines(order)}
                    startedAt={order.started_at ? new Date(order.started_at) : null}
                    compact
                  />
                </>
              );
              return (
                <li key={order.id} className="border-l-4 border-l-warning-400">
                  {/* The total stays top right; on a phone the times go under the order. */}
                  <Link
                    href={`/orders/${order.id}`}
                    className="flex items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {heading(order)}
                      <span className="mt-1 flex flex-col text-xs text-default-500 sm:hidden">
                        {times}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
                      <span className="font-medium tabular-nums">
                        {formatPesos(order.total ?? 0)}
                      </span>
                      <span className="hidden flex-col items-end text-xs text-default-500 sm:flex">
                        {times}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle dot="bg-default-400">{t('list.queueTitle')}</SectionTitle>
        {entries.length === 0 ? (
          <p className={EMPTY}>{t('list.queueEmpty')}</p>
        ) : (
          <ul aria-label={t('list.queueLabel')} className={LIST}>
            {entries.map((entry) => {
              if (entry.kind === 'arriving') {
                const { reservation } = entry;
                const name = reservation.customer_name ?? '';
                const minutesLeft = Math.max(
                  0,
                  Math.ceil(
                    (new Date(reservation.grace_until ?? now).getTime() - now.getTime()) / 60_000
                  )
                );
                return (
                  // CA-18: a reservation on its way, in its place, without a turn.
                  <li
                    key={`r-${reservation.id}`}
                    // A reservation is dark-edged: dashed while the customer is on the way.
                    className="relative flex items-start gap-3 border-l-4 border-dashed border-l-foreground bg-default-50/60 p-4 hover:bg-default-100/60"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-full border border-dashed border-foreground/40 text-foreground">
                      <CalendarClock aria-hidden className="size-4" />
                    </span>
                    <Link
                      // «Volver» from the reservation comes back here.
                      href={`/agenda/${reservation.id}?from=orders`}
                      className="flex min-w-0 flex-1 flex-col gap-0.5 outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{t('list.arriving')}</span>
                        <ReservedTag>
                          {t('list.reserved', {
                            time: clock(new Date(reservation.slot_start ?? now)),
                          })}
                        </ReservedTag>
                      </span>
                      <span className="text-xs text-default-500">
                        {t('list.arrivingText', {
                          name,
                          time: clock(new Date(reservation.slot_start ?? now)),
                        })}
                      </span>
                      {/* CA-33: until when it keeps its turn, counting down; the last 5 minutes stand out. */}
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          minutesLeft <= 5 ? 'font-semibold text-foreground' : 'text-default-600'
                        }`}
                      >
                        <Timer aria-hidden className="size-3.5" />
                        {t('list.keepsTurn', {
                          time: clock(new Date(reservation.grace_until ?? now)),
                          minutes: minutesLeft,
                        })}
                      </span>
                      {/* CA-38: the time already given, so staff know how many chances it had. */}
                      {(reservation.extensions ?? 0) > 0 && (
                        <span className="text-xs text-default-500">
                          {t('list.extendedSoFar', {
                            minutes: reservation.extended_minutes ?? 0,
                            times: reservation.extensions ?? 0,
                          })}
                        </span>
                      )}
                    </Link>
                    {(reservation.effective_tolerance_minutes ?? 0) + 5 <= 60 && (
                      <Button
                        size="sm"
                        variant="bordered"
                        // Above the stretched link: giving more time does not open the reservation.
                        className="relative z-10 shrink-0 self-center bg-content1"
                        isDisabled={isPending}
                        onPress={() => extend(reservation)}
                      >
                        {/* WCAG 2.5.3: who it is for, before the visible text. */}
                        <span className="sr-only">{t('list.extendFor', { name })}</span>
                        {t('list.extend')}
                      </Button>
                    )}
                  </li>
                );
              }
              const { order, turn } = entry;
              const standing = reservationStanding(order);
              const times = (
                <>
                  <span>{t('list.arrivedAgo', { ago: ago(order.opened_at) })}</span>
                  <OrderEstimate lines={estimateLines(order)} startedAt={null} compact />
                </>
              );
              return (
                // The whole card opens the order, like the other sections: the link stretches over it
                // (after:inset-0) and «Empezar» sits above (a button inside a link is not valid).
                // Total and times stacked on the right; on a phone the times and «Empezar» go on
                // their own line under the order.
                <li
                  key={order.id}
                  // The dark edge, now solid, only while the reservation gives it its turn (arrived on time).
                  className={`relative flex items-start gap-3 border-l-4 p-4 hover:bg-default-50 has-[a:focus-visible]:bg-default-50 ${
                    standing === 'kept' ? 'border-l-foreground' : 'border-l-default-300'
                  }`}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-default-100 text-xs font-semibold text-default-700 tabular-nums">
                    {t('list.turn', { turn })}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex min-w-0 flex-1 items-start justify-between gap-3 outline-none after:absolute after:inset-0 after:content-['']"
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">
                          {t('number', { number: order.number ?? 0 })} · {order.customer_name}
                        </span>
                        <span className="text-xs text-default-500">{vehicleOf(order)}</span>
                        <span className="text-xs text-default-500">
                          {(order.services ?? []).join(' · ')}
                        </span>
                        {standing && order.reserved_start && (
                          <span className="pt-1">
                            <ReservedTag outlined={standing !== 'kept'}>
                              {t(RESERVED_TEXT[standing], {
                                time: clock(new Date(order.reserved_start)),
                              })}
                            </ReservedTag>
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-0.5 text-sm">
                        <span className="font-medium tabular-nums">
                          {formatPesos(order.total ?? 0)}
                        </span>
                        <span className="hidden flex-col items-end text-xs text-default-500 sm:flex">
                          {times}
                        </span>
                      </span>
                    </Link>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="flex flex-col text-xs text-default-500 sm:hidden">
                        {times}
                      </span>
                      <Button
                        size="sm"
                        variant="bordered"
                        // Above the stretched link: starting does not open the order.
                        className="relative z-10 shrink-0 bg-content1"
                        aria-label={t('list.startLabel', { number: order.number ?? 0 })}
                        startContent={<Play aria-hidden className="size-3.5" />}
                        isDisabled={isPending}
                        onPress={() => {
                          setNotice(undefined);
                          start(order);
                        }}
                      >
                        {t('list.start')}
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle dot="bg-success-500">{t('list.closedTitle')}</SectionTitle>
        {closed.rows.length === 0 ? (
          <p className={EMPTY}>{t('list.closedEmpty')}</p>
        ) : (
          <ul aria-label={t('list.closedLabel')} className={LIST}>
            {closed.rows.map((order) => (
              // Done: green; voided: grey (and its «Anulada» label, never colour alone).
              <li
                key={order.id}
                className={`border-l-4 ${order.status === 'voided' ? 'border-l-default-300' : 'border-l-success-500'}`}
              >
                <Link href={`/orders/${order.id}`} className={ROW_LINK}>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {t('number', { number: order.number ?? 0 })} · {order.customer_name}
                      {order.status === 'voided' && <OrderStatusChip stage="voided" />}
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
            <span className="text-default-500">{t('list.page', { page, pages })}</span>
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
