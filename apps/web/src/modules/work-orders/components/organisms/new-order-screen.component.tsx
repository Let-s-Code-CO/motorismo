'use client';

import { useCallback, useState } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { useQuery } from '@tanstack/react-query';

import { notify } from '@web/modules/core/lib/toast.lib';
import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import CustomerHistory from '@web/modules/work-orders/components/organisms/customer-history.component';
import CustomerPicker from '@web/modules/work-orders/components/organisms/customer-picker.component';
import OrderEditor from '@web/modules/work-orders/components/organisms/order-editor.component';
import { customerHistoryQueryOptions } from '@web/modules/work-orders/queries/work-orders.queries';
import type {
  PickerCustomer,
  PickerVehicle,
} from '@web/modules/work-orders/types/work-orders.types';

/**
 * «Nueva orden» (spec 008, HU-01): first who brings which vehicle (CA-01, CA-02) and their history
 * (HU-03), then the services, who does them and the totals (CA-03 to CA-07). Once opened, the
 * order's page takes over.
 */
type NewOrderScreenProps = {
  /**
   * The reservation the customer arrived with (spec 012, CA-12): its customer, vehicle and services
   * come already set, and saving turns it into the order (CA-13).
   */
  reservation?: ReservationSummary;
};

const NewOrderScreen = ({ reservation }: NewOrderScreenProps = {}) => {
  const t = useTranslations('orders');
  const router = useRouter();
  const [customer, setCustomer] = useState<PickerCustomer | null>(
    reservation?.customer_id
      ? {
          id: reservation.customer_id,
          full_name: reservation.customer_name ?? '',
          phone: reservation.customer_phone,
          email: null,
        }
      : null
  );
  const [vehicle, setVehicle] = useState<PickerVehicle | null>(null);
  const chooseVehicle = useCallback((next: PickerVehicle | null) => setVehicle(next), []);
  const history = useQuery({
    ...customerHistoryQueryOptions(customer?.id ?? ''),
    enabled: !!customer,
  });

  return (
    <section className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t('new')}</h1>
      <div className="rounded-large border border-divider bg-content1 p-5 shadow-small">
        <CustomerPicker
          customer={customer}
          vehicleId={vehicle?.id ?? null}
          onCustomerChange={setCustomer}
          onVehicleChange={chooseVehicle}
          // The customer of a reservation is fixed: the reservation is theirs (CA-19).
          customerLocked={!!reservation}
          initialVehicleId={reservation?.vehicle_id ?? null}
          // Its vehicle already had an order open: that order takes the reservation.
          openOrderQuery={reservation ? `?reservation=${reservation.id}` : ''}
        />
      </div>
      {/* HU-03: how many times they have come and the last two visits (CA-15, CA-17). */}
      {customer && history.data && (
        <div className="rounded-large border border-divider bg-content1 p-5 shadow-small">
          <CustomerHistory orders={history.data} variant="summary" />
        </div>
      )}
      {customer && vehicle && (
        <OrderEditor
          key={vehicle.id}
          customer={customer}
          vehicle={vehicle}
          reservation={reservation}
          onSaved={(id) => {
            // Spec 013, CA-05: «Orden abierta.» shows on the order, once (not again on reload).
            notify({ tone: 'success', text: t('editor.opened'), after: `/orders/${id}` });
            router.push(`/orders/${id}`);
          }}
        />
      )}
    </section>
  );
};

export default NewOrderScreen;
