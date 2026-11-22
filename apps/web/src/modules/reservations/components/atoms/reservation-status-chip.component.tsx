'use client';

import { useTranslations } from 'next-intl';

import { Chip } from '@heroui/react';

import type { ReservationStatus } from '@web/modules/reservations/types/reservations.types';

/** State colours (CLAUDE.md, only for states): pending dark, attended green, no-show amber, cancelled grey. */
const COLOR = {
  pending: 'primary',
  attended: 'success',
  cancelled: 'default',
  no_show: 'warning',
} as const;

/** «Pendiente», «Atendida», «Cancelada» or «No asistió» (spec 012, RF-02). */
const ReservationStatusChip = ({ status }: { status: ReservationStatus }) => {
  const t = useTranslations('reservations.status');

  return (
    <Chip size="sm" variant="dot" color={COLOR[status]}>
      {t(status)}
    </Chip>
  );
};

export default ReservationStatusChip;
