'use client';

import { useTranslations } from 'next-intl';

import ReservationForm from '@web/modules/reservations/components/organisms/reservation-form.component';
import type { AgendaDay } from '@web/modules/reservations/types/reservations.types';

type NewReservationScreenProps = { day: AgendaDay; initialStart: string | null };

/** «Nueva reserva» (spec 012, HU-01): the form, on the day chosen in the agenda. */
const NewReservationScreen = ({ day, initialStart }: NewReservationScreenProps) => {
  const t = useTranslations('reservations.form');

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('titleNew')}</h1>
      <ReservationForm day={day} initialStart={initialStart} />
    </section>
  );
};

export default NewReservationScreen;
