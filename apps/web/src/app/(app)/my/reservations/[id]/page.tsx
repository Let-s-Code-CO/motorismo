import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { requireCustomer } from '@web/modules/auth/api/auth.server';
import {
  getBookableDay,
  getBookableServices,
  getMyReservations,
} from '@web/modules/customer-area/api/customer-area.server';
import MyReservationForm from '@web/modules/customer-area/components/organisms/my-reservation-form.component';
import { toMyVehicle } from '@web/modules/customer-area/utils/my-vehicles.utils';
import { parseAgendaDate, todayIn } from '@web/modules/reservations/utils/agenda-date.utils';
import { listCustomerVehicles } from '@web/modules/vehicles/api/vehicles.server';

type ChangePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
};

/**
 * The customer changes one of their pending reservations (spec 014, CA-18): on its own day, or on the
 * one of `?date=`. Not theirs, or no longer pending (CA-20), is not found.
 */
const ChangeMyReservationPage = async ({ params, searchParams }: ChangePageProps) => {
  const customer = await requireCustomer();
  const t = await getTranslations('customerArea.form');
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const today = todayIn(new Date());
  const reservation = (await getMyReservations(today)).find(
    (item) => item.id === id && item.status === 'pending'
  );
  if (!reservation) notFound();

  const ownDay = todayIn(new Date(reservation.slot_start));
  const date = parseAgendaDate(query.date, ownDay);
  const [day, services, vehicles] = await Promise.all([
    getBookableDay(date),
    getBookableServices(),
    listCustomerVehicles(customer.id),
  ]);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('titleEdit')}</h1>
        <p className="text-default-500">{t('description')}</p>
      </div>
      <MyReservationForm
        day={day}
        services={services}
        vehicles={vehicles.active.map(toMyVehicle)}
        reservation={reservation}
      />
    </section>
  );
};

export default ChangeMyReservationPage;
