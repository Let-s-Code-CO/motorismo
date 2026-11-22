'use client';

import { useId, useState } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Button } from '@heroui/react';
import { CalendarPlus, Pencil, X } from 'lucide-react';

import { notify } from '@web/modules/core/lib/toast.lib';
import ArriveBy from '@web/modules/customer-area/components/atoms/arrive-by.component';
import CancelMyReservationDialog from '@web/modules/customer-area/components/organisms/cancel-my-reservation-dialog.component';
import useSlotLabel from '@web/modules/customer-area/hooks/slot-label.hook';
import type { MyReservation } from '@web/modules/customer-area/types/customer-area.types';
import ReservationStatusChip from '@web/modules/reservations/components/atoms/reservation-status-chip.component';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

const LIST =
  'flex flex-col divide-y divide-divider overflow-hidden rounded-large border border-divider bg-content1 shadow-small';

/**
 * The customer's «Mis reservas» (spec 014, HU-04): the pending ones first, nearest first, with until
 * when to arrive, «Cambiar» and «Cancelar reserva» (CA-17, CA-20); then the recent past ones with
 * their state and who cancelled them. Cancelling asks first (CA-19).
 */
const MyReservationsScreen = ({ reservations }: { reservations: MyReservation[] }) => {
  const t = useTranslations('customerArea');
  const router = useRouter();
  const slotLabel = useSlotLabel();
  const pendingId = useId();
  const pastId = useId();
  const [cancelling, setCancelling] = useState<MyReservation | null>(null);

  const pending = reservations.filter((reservation) => reservation.status === 'pending');
  const past = reservations.filter((reservation) => reservation.status !== 'pending');
  const vehicleOf = (reservation: MyReservation) =>
    reservation.vehicle_id ? vehicleLabel(reservation, t('vehicle.noPlate')) : t('vehicle.none');

  const details = (reservation: MyReservation) => (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="font-medium first-letter:uppercase">
        {slotLabel(reservation.slot_start, reservation.slot_end)}
      </p>
      <p className="text-sm text-default-600">{vehicleOf(reservation)}</p>
      {reservation.services.length > 0 && (
        <p className="text-sm text-default-500">{reservation.services.join(' · ')}</p>
      )}
    </div>
  );

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('reservations.title')}</h1>
          <p className="text-default-500">{t('reservations.description')}</p>
        </div>
        <Button
          as={Link}
          href="/my/reservations/new"
          color="primary"
          className="font-medium"
          startContent={<CalendarPlus aria-hidden className="size-4" />}
        >
          {t('reservations.new')}
        </Button>
      </div>

      {reservations.length === 0 && (
        <p className="rounded-large border border-dashed border-default-300 p-5 text-center text-sm text-default-500">
          {t('reservations.empty')}
        </p>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 id={pendingId} className="font-semibold tracking-tight">
            {t('reservations.pending')}
          </h2>
          <ul aria-labelledby={pendingId} className={LIST}>
            {pending.map((reservation) => {
              const slot = slotLabel(reservation.slot_start, reservation.slot_end);
              return (
                <li key={reservation.id} className="flex flex-col gap-3 p-4">
                  {details(reservation)}
                  <ArriveBy
                    graceUntil={reservation.grace_until}
                    className="text-sm font-medium text-default-700"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      as={Link}
                      href={`/my/reservations/${reservation.id}`}
                      size="sm"
                      variant="bordered"
                      aria-label={t('reservations.changeLabel', { slot })}
                      startContent={<Pencil aria-hidden className="size-3.5" />}
                    >
                      {t('reservations.change')}
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      className="text-danger-600 data-[hover=true]:bg-danger-50"
                      aria-label={t('reservations.cancelLabel', { slot })}
                      startContent={<X aria-hidden className="size-3.5" />}
                      onPress={() => setCancelling(reservation)}
                    >
                      {t('reservations.cancel')}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {past.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 id={pastId} className="font-semibold tracking-tight">
            {t('reservations.past')}
          </h2>
          <ul aria-labelledby={pastId} className={LIST}>
            {past.map((reservation) => (
              <li key={reservation.id} className="flex items-start justify-between gap-3 p-4">
                {details(reservation)}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ReservationStatusChip status={reservation.status} />
                  {reservation.status === 'cancelled' && (
                    <span className="text-xs text-default-500">
                      {reservation.cancelled_by_customer
                        ? t('reservations.cancelledByYou')
                        : t('reservations.cancelledByStaff')}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cancelling && (
        <CancelMyReservationDialog
          reservationId={cancelling.id}
          slot={slotLabel(cancelling.slot_start, cancelling.slot_end)}
          isOpen
          onClose={() => setCancelling(null)}
          onCancelled={() => {
            setCancelling(null);
            notify({ tone: 'success', text: t('reservations.cancelled') });
            router.refresh();
          }}
        />
      )}
    </section>
  );
};

export default MyReservationsScreen;
