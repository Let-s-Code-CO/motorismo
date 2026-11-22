'use client';

import { useState, useTransition } from 'react';

import { useFormatter, useNow, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button, Chip } from '@heroui/react';
import { ArrowLeft, DoorOpen, Pencil, Timer, UserX } from 'lucide-react';

import useClock from '@web/modules/core/hooks/clock.hook';
import { notify } from '@web/modules/core/lib/toast.lib';
import { formatMobile } from '@web/modules/core/utils/phone.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { markNoShow } from '@web/modules/reservations/actions/reservations.actions';
import ReservationStatusChip from '@web/modules/reservations/components/atoms/reservation-status-chip.component';
import { useDayTitle } from '@web/modules/reservations/components/molecules/day-nav.component';
import { useReservationVehicle } from '@web/modules/reservations/components/molecules/reservation-row.component';
import CancelReservationDialog from '@web/modules/reservations/components/organisms/cancel-reservation-dialog.component';
import ToleranceDialog from '@web/modules/reservations/components/organisms/tolerance-dialog.component';
import type {
  ReservationExtension,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';
import type { ReservationsErrorKey } from '@web/modules/reservations/utils/reservations-errors.utils';

type ReservationDetailProps = {
  reservation: ReservationSummary;
  /** Today in Colombia: «Llegó» is only for today's reservations (CA-19). */
  today: string;
  isAdmin: boolean;
  generalTolerance: number;
  /** Each «+5 min» it was given, oldest first (CA-38). */
  extensions?: ReservationExtension[];
  /** Where «Volver» goes: the agenda, or «Órdenes» when it was opened from the queue. */
  backTo?: 'agenda' | 'orders';
};

/**
 * A reservation (spec 012, CA-11): who, which vehicle, the services, the slot, its tolerance (general
 * or its own), the notes, its state and who did what and when. While pending: «Llegó» on its day
 * (CA-12, CA-19), «Cambiar» (CA-20), «Cancelar reserva» (CA-21) and, once its tolerance has passed,
 * «No asistió» (CA-22); the admin also changes its tolerance (CA-24, CA-25). An attended one links
 * to its order (RF-04).
 */
const ReservationDetail = ({
  reservation,
  today,
  isAdmin,
  generalTolerance,
  extensions = [],
  backTo = 'agenda',
}: ReservationDetailProps) => {
  const t = useTranslations('reservations');
  const format = useFormatter();
  const clock = useClock();
  const dayTitle = useDayTitle();
  const vehicleOf = useReservationVehicle();
  const router = useRouter();
  const now = useNow({ updateInterval: 30_000 });
  const [dialog, setDialog] = useState<'cancel' | 'tolerance'>();
  const [isPending, startTransition] = useTransition();

  const r = reservation;
  const pending = r.status === 'pending';
  const day = r.day ?? today;
  const graceOver = !!r.grace_until && now.getTime() > new Date(r.grace_until).getTime();
  const when = (instant: string) =>
    t('detail.when', {
      date: format.dateTime(new Date(instant), { day: 'numeric', month: 'long', year: 'numeric' }),
      time: clock(new Date(instant)),
    });
  const done = (text: string) => {
    setDialog(undefined);
    notify({ tone: 'success', text });
    router.refresh();
  };
  // Spec 013: a refusal of a standalone action is an error that stays until closed (CA-07).
  const failed = (error: ReservationsErrorKey) =>
    notify({ tone: 'danger', text: t(`errors.${error}`) });

  const noShow = () =>
    startTransition(async () => {
      const result = await callAction(() => markNoShow({ id: r.id }));
      if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
      if (result.ok) done(t('detail.noShowNotice'));
      else failed(result.error);
    });

  const trail = [
    r.created_at &&
      t('detail.created', { name: r.created_by_name ?? '' }) + ' ' + when(r.created_at),
    r.updated_at &&
      t('detail.updated', { name: r.updated_by_name ?? '' }) + ' ' + when(r.updated_at),
    r.cancelled_at &&
      t('detail.cancelled', { name: r.cancelled_by_name ?? '' }) + ' ' + when(r.cancelled_at),
    r.no_show_at &&
      t('detail.noShow', { name: r.no_show_by_name ?? '' }) + ' ' + when(r.no_show_at),
    r.attended_at &&
      t('detail.attended', { name: r.attended_by_name ?? '' }) + ' ' + when(r.attended_at),
  ].filter(Boolean) as string[];

  const tolerance = r.tolerance_minutes ?? r.effective_tolerance_minutes ?? generalTolerance;

  return (
    <section className="flex flex-col gap-6">
      <Link
        href={backTo === 'orders' ? '/orders' : `/agenda?date=${day}`}
        className="flex w-max items-center gap-1 text-sm text-default-500 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {backTo === 'orders' ? t('detail.backToOrders') : t('detail.back')}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('detail.title', { name: r.customer_name ?? '' })}
        </h1>
        {r.status && <ReservationStatusChip status={r.status} />}
        {/* CA-37: pending past its tolerance, next to «No asistió»; never marked by itself (RN-12). */}
        {pending && graceOver && (
          <Chip size="sm" variant="flat" color="warning">
            {t('flags.graceOver')}
          </Chip>
        )}
        {r.out_of_hours && (
          <Chip size="sm" variant="flat" color="warning">
            {t('flags.outOfHours')}
          </Chip>
        )}
        {r.over_capacity && (
          <Chip size="sm" variant="flat" color="warning">
            {t('flags.overCapacity')}
          </Chip>
        )}
      </div>

      <dl className="grid gap-4 rounded-large border border-divider bg-content1 p-5 shadow-small sm:grid-cols-2">
        <div>
          <dt className="text-xs text-default-500">{t('detail.slot')}</dt>
          <dd className="font-medium first-letter:uppercase">
            {dayTitle(day)} ·{' '}
            {r.slot_start &&
              r.slot_end &&
              t('day.slot', {
                start: clock(new Date(r.slot_start)),
                end: clock(new Date(r.slot_end)),
              })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-default-500">{t('detail.customer')}</dt>
          <dd className="font-medium">{r.customer_name}</dd>
        </div>
        <div>
          <dt className="text-xs text-default-500">{t('detail.phone')}</dt>
          <dd>{r.customer_phone ? formatMobile(r.customer_phone) : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-default-500">{t('detail.vehicle')}</dt>
          <dd>{vehicleOf(r)}</dd>
        </div>
        <div>
          <dt className="text-xs text-default-500">{t('detail.services')}</dt>
          <dd>{r.services?.length ? r.services.join(' · ') : t('row.noServices')}</dd>
        </div>
        <div>
          <dt className="text-xs text-default-500">{t('detail.tolerance')}</dt>
          <dd>
            {r.tolerance_minutes === null
              ? t('detail.toleranceGeneral', { minutes: tolerance })
              : t('detail.toleranceOwn', { minutes: tolerance })}
          </dd>
        </div>
        {r.notes && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-default-500">{t('detail.notes')}</dt>
            <dd>{r.notes}</dd>
          </div>
        )}
        {r.cancel_reason && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-default-500">{t('detail.status')}</dt>
            <dd>{t('detail.cancelReason', { reason: r.cancel_reason })}</dd>
          </div>
        )}
      </dl>

      {(pending || r.work_order_id) && (
        <div className="flex flex-wrap gap-2">
          {pending && day === today && (
            <Button
              as={Link}
              href={`/orders/new?reservation=${r.id}`}
              color="primary"
              className="font-medium"
              startContent={<DoorOpen aria-hidden className="size-4" />}
            >
              {t('detail.arrived')}
            </Button>
          )}
          {pending && (
            <Button
              as={Link}
              href={`/agenda/${r.id}?edit=1&date=${day}`}
              variant="bordered"
              startContent={<Pencil aria-hidden className="size-4" />}
            >
              {t('detail.edit')}
            </Button>
          )}
          {pending && graceOver && (
            <Button
              variant="bordered"
              isLoading={isPending}
              onPress={noShow}
              startContent={<UserX aria-hidden className="size-4" />}
            >
              {t('detail.noShowAction')}
            </Button>
          )}
          {pending && isAdmin && (
            <Button
              variant="bordered"
              onPress={() => setDialog('tolerance')}
              startContent={<Timer aria-hidden className="size-4" />}
            >
              {t('detail.changeTolerance')}
            </Button>
          )}
          {r.work_order_id && (
            <Button as={Link} href={`/orders/${r.work_order_id}`} variant="bordered">
              {t('detail.order', { number: r.work_order_number ?? 0 })}
            </Button>
          )}
        </div>
      )}

      {/* CA-38: every «+5 min» it was given, so staff know how much time the customer had. */}
      {extensions.length > 0 && (
        <section
          aria-labelledby="reservation-extensions"
          className="flex flex-col gap-2 rounded-large border border-divider bg-content1 p-5 shadow-small"
        >
          <h2 id="reservation-extensions" className="font-semibold tracking-tight">
            {t('detail.extensionsTitle')}
          </h2>
          <p className="text-sm">
            {t('detail.extensionsSummary', {
              times: extensions.length,
              minutes: extensions.reduce((sum, extension) => sum + (extension.minutes ?? 0), 0),
            })}
          </p>
          <ol className="flex flex-col gap-1 text-sm text-default-500">
            {extensions.map((extension) => (
              <li key={extension.id}>
                {t('detail.extension', {
                  minutes: extension.minutes ?? 0,
                  name: extension.created_by_name ?? '',
                  date: format.dateTime(new Date(extension.created_at ?? 0), {
                    day: 'numeric',
                    month: 'long',
                  }),
                  time: clock(new Date(extension.created_at ?? 0)),
                  until: clock(new Date(extension.grace_until ?? 0)),
                })}
              </li>
            ))}
          </ol>
        </section>
      )}

      {trail.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-default-500">
          {trail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {pending && (
        <section
          aria-labelledby="cancel-reservation"
          className="flex flex-col gap-3 rounded-large border border-divider bg-content1 p-5 shadow-small"
        >
          <h2 id="cancel-reservation" className="font-semibold tracking-tight">
            {t('cancelDialog.title')}
          </h2>
          <p className="text-sm text-default-500">{t('cancelDialog.text')}</p>
          <Button
            color="danger"
            className="w-max bg-danger-600 font-medium text-white dark:bg-danger-300"
            onPress={() => setDialog('cancel')}
          >
            {t('detail.cancel')}
          </Button>
        </section>
      )}

      <CancelReservationDialog
        reservationId={r.id ?? ''}
        isOpen={dialog === 'cancel'}
        onClose={() => setDialog(undefined)}
        onCancelled={() => done(t('detail.cancelledNotice'))}
      />
      {isAdmin && (
        <ToleranceDialog
          reservationId={r.id ?? ''}
          own={r.tolerance_minutes}
          general={generalTolerance}
          isOpen={dialog === 'tolerance'}
          onClose={() => setDialog(undefined)}
          onSaved={() => done(t('detail.toleranceNotice'))}
        />
      )}
    </section>
  );
};

export default ReservationDetail;
