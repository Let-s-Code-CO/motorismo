'use client';

import { useEffect, useState } from 'react';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Radio,
  RadioGroup,
} from '@heroui/react';
import { Plus, Search, UserRound } from 'lucide-react';

import { formatMobile } from '@web/modules/core/utils/phone.utils';
import { singleOption } from '@web/modules/core/utils/selection.utils';
import VehicleForm from '@web/modules/vehicles/components/organisms/vehicle-form.component';
import { orderKeys } from '@web/modules/work-orders/queries/work-orders.keys';
import {
  customerSearchQueryOptions,
  customerVehiclesQueryOptions,
} from '@web/modules/work-orders/queries/work-orders.queries';
import type {
  PickerCustomer,
  PickerVehicle,
} from '@web/modules/work-orders/types/work-orders.types';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

type CustomerPickerProps = {
  customer: PickerCustomer | null;
  vehicleId: string | null;
  onCustomerChange: (customer: PickerCustomer | null) => void;
  onVehicleChange: (vehicle: PickerVehicle | null) => void;
};

/**
 * Who brings which vehicle (spec 008, HU-01): find the customer by name, phone or plate (CA-01),
 * then choose one of their active vehicles — the only one comes already chosen (RN-10) — or register
 * it right there (CA-02). A vehicle with an open order offers that order instead.
 */
const CustomerPicker = ({
  customer,
  vehicleId,
  onCustomerChange,
  onVehicleChange,
}: CustomerPickerProps) => {
  const t = useTranslations('orders.picker');
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [registering, setRegistering] = useState(false);
  const [pendingVehicle, setPendingVehicle] = useState<string | null>(null);

  const search = useQuery({
    ...customerSearchQueryOptions(q),
    enabled: !customer && q.trim().length >= 2,
  });
  const vehicles = useQuery({
    ...customerVehiclesQueryOptions(customer?.id ?? ''),
    enabled: !!customer,
  });

  // RN-10: the only free vehicle is chosen by itself; CA-02: so is one just registered.
  useEffect(() => {
    if (!vehicles.data || vehicleId) return;
    const registered = pendingVehicle && vehicles.data.find(({ id }) => id === pendingVehicle);
    const chosen = registered || singleOption(vehicles.data.filter(({ openOrder }) => !openOrder));
    // Once chosen, vehicleId is set and this stops; another customer never has the pending id.
    if (chosen) onVehicleChange(chosen);
  }, [vehicles.data, vehicleId, pendingVehicle, onVehicleChange]);

  if (!customer) {
    return (
      <div className="flex flex-col gap-3">
        <Input
          label={t('customerSearch')}
          placeholder={t('customerSearchPlaceholder')}
          labelPlacement="outside"
          variant="bordered"
          value={q}
          onValueChange={setQ}
          startContent={<Search aria-hidden className="size-4 shrink-0 text-default-400" />}
          autoFocus
        />
        {search.data && search.data.length === 0 && (
          <p className="text-sm text-default-500">{t('noResults')}</p>
        )}
        {!!search.data?.length && (
          <ul className="flex flex-col divide-y divide-divider rounded-medium border border-divider">
            {search.data.map((found) => (
              <li key={found.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none hover:bg-default-100 focus-visible:bg-default-100"
                  onClick={() => onCustomerChange(found)}
                >
                  <UserRound aria-hidden className="size-4 shrink-0 text-default-400" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{found.full_name}</span>
                    <span className="truncate text-xs text-default-500">
                      {[found.phone && formatMobile(found.phone), found.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <UserRound aria-hidden className="size-4 text-default-400" />
          {customer.full_name}
        </span>
        <Button
          size="sm"
          variant="light"
          onPress={() => {
            onVehicleChange(null);
            onCustomerChange(null);
          }}
        >
          {t('changeCustomer')}
        </Button>
      </div>

      {vehicles.data && vehicles.data.length === 0 && (
        <p className="text-sm text-default-500">{t('noVehicles')}</p>
      )}
      {!!vehicles.data?.length && (
        <RadioGroup
          label={t('vehicle')}
          value={vehicleId}
          onValueChange={(id) => onVehicleChange(vehicles.data.find((v) => v.id === id) ?? null)}
        >
          {vehicles.data.map((vehicle) => (
            <div key={vehicle.id} className="flex flex-wrap items-center gap-x-3">
              <Radio value={vehicle.id} isDisabled={!!vehicle.openOrder}>
                {vehicleLabel(vehicle, t('noPlate'))}
              </Radio>
              {vehicle.openOrder && (
                <span className="text-xs text-default-500">
                  {t('openOrderHint')}{' '}
                  <Link
                    href={`/orders/${vehicle.openOrder.id}`}
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {`Orden #${vehicle.openOrder.number}`}
                  </Link>
                </span>
              )}
            </div>
          ))}
        </RadioGroup>
      )}

      <Button
        variant="bordered"
        className="w-max"
        startContent={<Plus aria-hidden className="size-4" />}
        onPress={() => setRegistering(true)}
      >
        {t('registerVehicle')}
      </Button>

      <Modal
        isOpen={registering}
        onOpenChange={(open) => !open && setRegistering(false)}
        size="xl"
        scrollBehavior="outside"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{t('registerVehicleTitle')}</ModalHeader>
              <ModalBody className="pb-6">
                <VehicleForm
                  customerId={customer.id}
                  onCancel={onClose}
                  onSaved={async (id) => {
                    onClose();
                    setPendingVehicle(id);
                    onVehicleChange(null);
                    await queryClient.invalidateQueries({
                      queryKey: orderKeys.vehicles(customer.id),
                    });
                  }}
                />
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default CustomerPicker;
