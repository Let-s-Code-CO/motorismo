import { z } from 'zod';

import { getStaffForPage } from '@web/modules/auth/api/auth.server';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';
import { getCustomer } from '@web/modules/customers/api/customers.server';
import { getAgendaDay } from '@web/modules/reservations/api/reservations.server';
import NewReservationScreen from '@web/modules/reservations/components/organisms/new-reservation-screen.component';
import { parseAgendaDate, todayIn } from '@web/modules/reservations/utils/agenda-date.utils';

type NewReservationPageProps = {
  searchParams: Promise<{ date?: string; start?: string; customer?: string; vehicle?: string }>;
};

const isUuid = (value?: string): value is string => !!value && z.uuid().safeParse(value).success;

/**
 * «Nueva reserva» (spec 012, HU-01): staff only. A slot chosen in the agenda comes as `start`; a
 * customer (and one of their vehicles) chosen from their record or the list, as `customer` and
 * `vehicle` (amendment HU-07). A customer who does not exist or is disabled is ignored, with the
 * vehicle (CA-43); a vehicle that is not theirs or is retired is simply never chosen.
 */
const NewReservationPage = async ({ searchParams }: NewReservationPageProps) => {
  const staff = await getStaffForPage();
  if (!staff) return <NoPermission audience="customer" />;

  const params = await searchParams;
  const date = parseAgendaDate(params.date, todayIn(new Date()));
  const [day, customer] = await Promise.all([
    getAgendaDay(date),
    isUuid(params.customer) ? getCustomer(params.customer) : null,
  ]);
  const bookable = customer && customer.disabled_at === null ? customer : null;

  return (
    <NewReservationScreen
      day={day}
      initialStart={params.start ?? null}
      initialCustomer={
        bookable && {
          id: bookable.id,
          full_name: bookable.full_name,
          phone: bookable.phone,
          email: bookable.email,
        }
      }
      initialVehicleId={bookable && isUuid(params.vehicle) ? params.vehicle : null}
    />
  );
};

export default NewReservationPage;
