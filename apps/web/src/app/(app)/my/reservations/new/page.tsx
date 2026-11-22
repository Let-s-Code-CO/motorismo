import { getTranslations } from 'next-intl/server';

import { requireCustomer } from '@web/modules/auth/api/auth.server';
import {
  getBookableDay,
  getBookableServices,
} from '@web/modules/customer-area/api/customer-area.server';
import MyReservationForm from '@web/modules/customer-area/components/organisms/my-reservation-form.component';
import { toMyVehicle } from '@web/modules/customer-area/utils/my-vehicles.utils';
import { parseAgendaDate, todayIn } from '@web/modules/reservations/utils/agenda-date.utils';
import { listCustomerVehicles } from '@web/modules/vehicles/api/vehicles.server';

type NewPageProps = { searchParams: Promise<{ date?: string }> };

/** The customer books a seat (spec 014, HU-03): the day of `?date=`, today by default. */
const NewMyReservationPage = async ({ searchParams }: NewPageProps) => {
  const customer = await requireCustomer();
  const t = await getTranslations('customerArea.form');
  const date = parseAgendaDate((await searchParams).date, todayIn(new Date()));
  const [day, services, vehicles] = await Promise.all([
    getBookableDay(date),
    getBookableServices(),
    listCustomerVehicles(customer.id),
  ]);

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t('titleNew')}</h1>
        <p className="text-default-500">{t('description')}</p>
      </div>
      <MyReservationForm
        day={day}
        services={services}
        vehicles={vehicles.active.map(toMyVehicle)}
      />
    </section>
  );
};

export default NewMyReservationPage;
