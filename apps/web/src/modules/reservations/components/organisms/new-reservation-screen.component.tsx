'use client';

import { useTranslations } from 'next-intl';

import ReservationForm from '@web/modules/reservations/components/organisms/reservation-form.component';
import type { AgendaDay } from '@web/modules/reservations/types/reservations.types';
import type { PickerCustomer } from '@web/modules/work-orders/types/work-orders.types';

type NewReservationScreenProps = {
  day: AgendaDay;
  initialStart: string | null;
  /** Amendment HU-07: the customer (and vehicle) it was opened for, from their record or row. */
  initialCustomer?: PickerCustomer | null;
  initialVehicleId?: string | null;
};

/** «Nueva reserva» (spec 012, HU-01): the form, on the day chosen in the agenda. */
const NewReservationScreen = ({
  day,
  initialStart,
  initialCustomer,
  initialVehicleId,
}: NewReservationScreenProps) => {
  const t = useTranslations('reservations.form');

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('titleNew')}</h1>
      <ReservationForm
        day={day}
        initialStart={initialStart}
        initialCustomer={initialCustomer}
        initialVehicleId={initialVehicleId}
      />
    </section>
  );
};

export default NewReservationScreen;
