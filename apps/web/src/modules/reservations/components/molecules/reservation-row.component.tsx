'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Chip } from '@heroui/react';

import { formatMobile } from '@web/modules/core/utils/phone.utils';
import ReservationStatusChip from '@web/modules/reservations/components/atoms/reservation-status-chip.component';
import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

/** The vehicle of a reservation, or «Sin vehículo» (CA-01: it is optional). */
export const useReservationVehicle = () => {
  const t = useTranslations('reservations.row');
  return (reservation: ReservationSummary) =>
    reservation.vehicle_id
      ? vehicleLabel(
          {
            brand_name: reservation.brand_name,
            line_name: reservation.line_name,
            plate: reservation.plate,
          },
          t('noPlate')
        )
      : t('noVehicle');
};

/**
 * A reservation in the agenda (spec 012, CA-09): customer, phone, vehicle, services and state, and
 * the flags of CA-31 («Fuera del horario», «Sobrecupo»). It opens the reservation.
 */
const ReservationRow = ({ reservation }: { reservation: ReservationSummary }) => {
  const t = useTranslations('reservations');
  const vehicleOf = useReservationVehicle();
  const services = reservation.services ?? [];

  return (
    <Link
      href={`/agenda/${reservation.id}`}
      className="flex min-w-0 flex-wrap items-start justify-between gap-3 p-4 outline-none hover:bg-default-50 focus-visible:bg-default-50"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{reservation.customer_name}</span>
        {reservation.customer_phone && (
          <span className="text-xs text-default-500">
            {formatMobile(reservation.customer_phone)}
          </span>
        )}
        <span className="text-xs text-default-500">{vehicleOf(reservation)}</span>
        <span className="text-xs text-default-500">
          {services.length ? services.join(' · ') : t('row.noServices')}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {reservation.out_of_hours && (
          <Chip size="sm" variant="flat" color="warning">
            {t('flags.outOfHours')}
          </Chip>
        )}
        {reservation.over_capacity && (
          <Chip size="sm" variant="flat" color="warning">
            {t('flags.overCapacity')}
          </Chip>
        )}
        {reservation.status && <ReservationStatusChip status={reservation.status} />}
      </span>
    </Link>
  );
};

export default ReservationRow;
