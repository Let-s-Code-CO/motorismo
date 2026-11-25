'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { useQueryClient } from '@tanstack/react-query';

import { Alert, Button } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';

import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { saveVehicle } from '@web/modules/vehicles/actions/vehicles.actions';
import type { VehicleView } from '@web/modules/vehicles/api/vehicles.server';
import VehicleFields, {
  NEW_VEHICLE,
} from '@web/modules/vehicles/components/molecules/vehicle-fields.component';
import { vehicleKeys } from '@web/modules/vehicles/queries/vehicles.keys';
import {
  type VehicleFormInput,
  type VehicleFormValues,
  vehicleFormSchema,
} from '@web/modules/vehicles/schemas/vehicle.schema';
import { formatPlate } from '@web/modules/vehicles/utils/plate.utils';
import type { VehiclesErrorKey } from '@web/modules/vehicles/utils/vehicles-errors.utils';

type VehicleFormProps = {
  customerId: string;
  /** The vehicle being corrected; absent to register a new one. */
  vehicle?: VehicleView;
  /** Told the vehicle's id (a work order picks the vehicle just registered, spec 008 CA-02). */
  onSaved: (vehicleId: string) => void;
  onCancel: () => void;
};

const fromVehicle = (vehicle: VehicleView): VehicleFormInput => ({
  vehicle_type: vehicle.vehicle_type,
  vehicle_class: vehicle.vehicle_class,
  brand_name: vehicle.brand?.name ?? '',
  line_name: vehicle.line?.name ?? '',
  displacement_cc: vehicle.displacement_cc,
  color: vehicle.color,
  plate: vehicle.plate ? formatPlate(vehicle.plate) : '',
  plate_city_code: vehicle.plate_city_code,
});

/**
 * Registers or corrects a vehicle (spec 005, HU-01 / HU-05 / HU-06): its fields (`VehicleFields`),
 * the database's refusal and saving. Used by staff in a customer's record and in «Nueva orden», and
 * by the customer in «Mis vehículos».
 */
const VehicleForm = ({ customerId, vehicle, onSaved, onCancel }: VehicleFormProps) => {
  const t = useTranslations('vehicles');
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<VehiclesErrorKey>();

  const form = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: vehicle ? fromVehicle(vehicle) : NEW_VEHICLE,
  });
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() =>
      saveVehicle({ ...values, customer_id: customerId, vehicle_id: vehicle?.id ?? null })
    );
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    // A new brand or line may have joined the catalog: suggest it from now on (CA-13).
    await queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
    onSaved(result.id);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-5">
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}

      <VehicleFields form={form} />

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="light" onPress={onCancel}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
          {t('form.save')}
        </Button>
      </div>
    </form>
  );
};

export default VehicleForm;
