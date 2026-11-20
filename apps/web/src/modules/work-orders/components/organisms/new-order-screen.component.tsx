'use client';

import { useCallback, useState } from 'react';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { useQuery } from '@tanstack/react-query';

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
const NewOrderScreen = () => {
  const t = useTranslations('orders');
  const router = useRouter();
  const [customer, setCustomer] = useState<PickerCustomer | null>(null);
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
          onSaved={(id) => router.push(`/orders/${id}?saved=opened`)}
        />
      )}
    </section>
  );
};

export default NewOrderScreen;
