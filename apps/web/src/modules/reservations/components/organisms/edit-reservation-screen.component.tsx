'use client';

import { useTranslations } from 'next-intl';

import ReservationForm from '@web/modules/reservations/components/organisms/reservation-form.component';
import type {
  AgendaDay,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';

type EditReservationScreenProps = { day: AgendaDay; reservation: ReservationSummary };

/** Changing a pending reservation (spec 012, CA-20): its customer stays; the rest can change. */
const EditReservationScreen = ({ day, reservation }: EditReservationScreenProps) => {
  const t = useTranslations('reservations.form');

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('titleEdit')}</h1>
      <ReservationForm day={day} reservation={reservation} />
    </section>
  );
};

export default EditReservationScreen;
