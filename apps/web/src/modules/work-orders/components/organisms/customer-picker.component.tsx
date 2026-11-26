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
import { Plus, Search, UserPlus, UserRound } from 'lucide-react';

import { formatMobile } from '@web/modules/core/utils/phone.utils';
import { singleOption } from '@web/modules/core/utils/selection.utils';
import CustomerForm from '@web/modules/customers/components/organisms/customer-form.component';
import PlateLabel from '@web/modules/vehicles/components/atoms/plate-label.component';
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
  /**
   * `reservation` (spec 012): the vehicle is optional, one with an open order can be booked for
   * another time, and a customer not registered yet is registered right there (CA-01, CA-02).
   */
  purpose?: 'order' | 'reservation';
  /** Changing a reservation keeps its customer (spec 012, CA-20): no «Cambiar de cliente». */
  customerLocked?: boolean;
  /** The vehicle to choose once the customer's vehicles load (spec 012: the reservation's). */
  initialVehicleId?: string | null;
  /** Appended to the link of a vehicle's open order (spec 012: `?reservation=…` to link it). */
  openOrderQuery?: string;
};

/** The radio value of «Sin vehículo». */
const NO_VEHICLE = 'none';

/**
 * Who brings which vehicle (spec 008, HU-01): find the customer by name, phone or plate (CA-01),
 * then choose one of their active vehicles — the only one comes already chosen (RN-10) — or register
 * it right there (CA-02). A vehicle with an open order offers that order instead.
 * A customer not found is registered right there, with what was searched and, optionally, their
 * first vehicle (spec 012, CA-02; spec 022, HU-01): they come out chosen, and their only vehicle
 * with them (RN-10).
 */
const CustomerPicker = ({
  customer,
  vehicleId,
  onCustomerChange,
  onVehicleChange,
  purpose = 'order',
  customerLocked = false,
  initialVehicleId = null,
  openOrderQuery = '',
}: CustomerPickerProps) => {
  const t = useTranslations('orders.picker');
  const tv = useTranslations('vehicles');
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registeringCustomer, setRegisteringCustomer] = useState(false);
  const forReservation = purpose === 'reservation';
  // An order cannot reuse a vehicle that already has one open; a reservation is for another time.
  const isBusy = (vehicle: PickerVehicle) => !forReservation && !!vehicle.openOrder;
  const [pendingVehicle, setPendingVehicle] = useState<string | null>(initialVehicleId);

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
    const free = vehicles.data.filter(({ openOrder }) => purpose === 'reservation' || !openOrder);
    // A vehicle with an open order is never chosen for a new order, even if it was the pending one.
    const registered = pendingVehicle && free.find(({ id }) => id === pendingVehicle);
    const chosen = registered || singleOption(free);
    // Once chosen, vehicleId is set and this stops; another customer never has the pending id.
    if (chosen) onVehicleChange(chosen);
  }, [vehicles.data, vehicleId, pendingVehicle, onVehicleChange, purpose]);

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
        <Modal
          isOpen={registeringCustomer}
          onOpenChange={(open) => !open && setRegisteringCustomer(false)}
          size="xl"
          scrollBehavior="outside"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader>{t('registerCustomerTitle')}</ModalHeader>
                <ModalBody className="pb-6">
                  <CustomerForm
                    mode="create"
                    initialSearch={q}
                    onCancel={onClose}
                    onSaved={(saved) => {
                      onClose();
                      if (saved) onCustomerChange(saved);
                    }}
                  />
                </ModalBody>
              </>
            )}
          </ModalContent>
        </Modal>
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
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{found.full_name}</span>
                    <span className="truncate text-xs text-default-500">
                      {[found.phone && formatMobile(found.phone), found.email]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {/* Spec 022, CA-11: the plate it matched by, only when it matched by plate. */}
                  {found.matchedPlate && (
                    <PlateLabel
                      plate={found.matchedPlate.plate}
                      city={found.matchedPlate.city ?? undefined}
                      legend={found.matchedPlate.legend}
                      size="sm"
                      className="shrink-0"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {/* Spec 012, CA-02; spec 022, CA-01: always at hand, as a link in the sentence that says
            nobody was found (or, otherwise, under the search and its results). */}
        <p className="text-sm text-default-500">
          {search.data?.length === 0 ? t('noResults') : t('newCustomerHint')}{' '}
          <button
            type="button"
            onClick={() => setRegisteringCustomer(true)}
            className="inline-flex cursor-pointer items-center gap-1 rounded-small font-medium text-foreground underline decoration-default-400 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-focus"
          >
            <UserPlus aria-hidden className="size-3.5" />
            {t('registerCustomer')}
          </button>
        </p>
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
        {!customerLocked && (
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
        )}
      </div>

      {vehicles.data && vehicles.data.length === 0 && (
        <p className="text-sm text-default-500">{t('noVehicles')}</p>
      )}
      {!!vehicles.data?.length && (
        <RadioGroup
          label={t('vehicle')}
          value={vehicleId ?? (forReservation ? NO_VEHICLE : null)}
          onValueChange={(id) => onVehicleChange(vehicles.data.find((v) => v.id === id) ?? null)}
        >
          {forReservation && <Radio value={NO_VEHICLE}>{t('noVehicleChoice')}</Radio>}
          {vehicles.data.map((vehicle) => (
            <div key={vehicle.id} className="flex flex-wrap items-center gap-x-3">
              <Radio
                value={vehicle.id}
                isDisabled={isBusy(vehicle)}
                // Spec 024, CA-04: the category a motorcycle's values come from.
                description={
                  vehicle.vehicle_type === 'motorcycle'
                    ? vehicle.category
                      ? tv(`categories.${vehicle.category}`)
                      : tv('summary.noCategory')
                    : undefined
                }
              >
                {vehicleLabel(vehicle, t('noPlate'))}
              </Radio>
              {isBusy(vehicle) && vehicle.openOrder && (
                <span className="text-xs text-default-500">
                  {t('openOrderHint')}{' '}
                  <Link
                    href={`/orders/${vehicle.openOrder.id}${openOrderQuery}`}
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
                  withCategory
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
