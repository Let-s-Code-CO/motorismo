'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  Radio,
  RadioGroup,
  Textarea,
} from '@heroui/react';

import BookingEstimate from '@web/modules/core/components/booking-estimate.component';
import { notify } from '@web/modules/core/lib/toast.lib';
import { saveMyReservation } from '@web/modules/customer-area/actions/customer-area.actions';
import type {
  BookableDay,
  BookableService,
  MyReservation,
  MyVehicle,
} from '@web/modules/customer-area/types/customer-area.types';
import type { CustomerAreaErrorKey } from '@web/modules/customer-area/utils/customer-area-errors.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import SlotPicker from '@web/modules/reservations/components/molecules/slot-picker.component';
import { isAgendaDate } from '@web/modules/reservations/utils/agenda-date.utils';
import ServiceGroups from '@web/modules/services/components/molecules/service-groups.component';
import useUnavailableReason from '@web/modules/services/hooks/combination.hook';
import { unavailableServices } from '@web/modules/services/utils/service-combination.utils';
import { vehicleLabel } from '@web/modules/work-orders/utils/vehicle-label.utils';

/** The radio value of «Sin vehículo». */
const NO_VEHICLE = 'none';
const FIELDSET =
  'flex flex-col gap-4 rounded-large border border-divider bg-content1 p-5 shadow-small';

type MyReservationFormProps = {
  /** The chosen day with its hours: changing the day reloads it from the server. */
  day: BookableDay;
  /** Their active vehicles. */
  vehicles: MyVehicle[];
  services: BookableService[];
  /** The reservation being changed (CA-18); without it, a new one. */
  reservation?: MyReservation;
};

type Values = { vehicle: string; slot_start: string; service_ids: string[]; notes: string };

/** The services offered for a vehicle's type; with no vehicle, every active one (CA-12). */
const offeredFor = (services: BookableService[], type: string | undefined) =>
  type ? services.filter((service) => service[type as 'motorcycle' | 'car' | 'bicycle']) : services;

/**
 * The customer books a seat for themselves (spec 014, HU-03) or changes one of their pending
 * reservations (CA-18): one of their vehicles or «Sin vehículo», the day and an hour with free seats
 * (CA-12, CA-13), the services offered for that vehicle and a note. The customer is never chosen
 * here: the server takes it from the session. A refusal stays in the form (spec 013, CA-08).
 */
const MyReservationForm = ({ day, vehicles, services, reservation }: MyReservationFormProps) => {
  const t = useTranslations('customerArea');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<CustomerAreaErrorKey>();
  const only = vehicles.length === 1 ? vehicles[0]!.id : '';

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    defaultValues: {
      vehicle: reservation
        ? (reservation.vehicle_id ?? NO_VEHICLE)
        : vehicles.length
          ? only
          : NO_VEHICLE,
      slot_start: reservation?.slot_start ?? '',
      service_ids: reservation?.service_ids ?? [],
      notes: reservation?.notes ?? '',
    },
  });
  const vehicleId = useWatch({ control, name: 'vehicle' });
  const chosen = vehicles.find((vehicle) => vehicle.id === vehicleId);
  const offered = offeredFor(services, chosen?.vehicle_type);
  // Spec 021, CA-06: the time of what would be sent (the ticked services offered for the vehicle).
  const serviceIds = useWatch({ control, name: 'service_ids' });
  const ticked = offered.filter((service) => serviceIds.includes(service.id));
  // Spec 024, CA-23 to CA-25: one package, nothing a ticked service already includes.
  const unavailableReason = useUnavailableReason();
  const unavailable = unavailableServices(offered, serviceIds);

  const goToDay = (date: string) => {
    if (!isAgendaDate(date) || date === day.date) return;
    setValue('slot_start', '');
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', date);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const offeredIds = new Set(offered.map((service) => service.id));
    const result = await callAction(() =>
      saveMyReservation({
        ...(reservation ? { id: reservation.id } : {}),
        vehicle_id: values.vehicle === NO_VEHICLE ? null : values.vehicle,
        slot_start: values.slot_start,
        service_ids: values.service_ids.filter((id) => offeredIds.has(id)),
        notes: values.notes,
      })
    );
    // No network (spec 006, CA-10): the app-wide notice speaks; the form stays as it was.
    if (!result) return;
    if (result.ok) {
      // Spec 013, CA-05: «Reserva guardada.» shows in «Mis reservas», once.
      notify({ tone: 'success', text: t('reservations.saved'), after: '/my/reservations' });
      router.push('/my/reservations');
      return;
    }
    setServerError(result.error);
    // CA-14: an hour that filled up meanwhile; the hours come back up to date.
    if (result.error === 'slotFull' || result.error === 'slotStarted') {
      setValue('slot_start', '');
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}

      <fieldset className={FIELDSET}>
        <legend className="sr-only">{t('form.vehicle')}</legend>
        <Controller
          control={control}
          name="vehicle"
          rules={{ required: 'vehicleRequired' }}
          render={({ field }) => (
            <RadioGroup
              label={t('form.vehicle')}
              value={field.value || null}
              onValueChange={field.onChange}
              description={t('form.noVehiclesHint')}
              isInvalid={!!errors.vehicle}
              errorMessage={errors.vehicle?.message && t(`validation.${errors.vehicle.message}`)}
            >
              {vehicles.map((vehicle) => (
                <Radio key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle, t('vehicle.noPlate'))}
                </Radio>
              ))}
              <Radio value={NO_VEHICLE}>{t('form.noVehicle')}</Radio>
            </RadioGroup>
          )}
        />
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className="sr-only">{t('form.slot')}</legend>
        <Input
          type="date"
          label={t('form.day')}
          labelPlacement="outside"
          variant="bordered"
          className="sm:max-w-xs"
          defaultValue={day.date}
          onValueChange={goToDay}
        />
        <Controller
          control={control}
          name="slot_start"
          rules={{ required: 'slotRequired' }}
          render={({ field }) => (
            <SlotPicker
              state={day.state}
              slots={day.slots}
              value={field.value || null}
              onChange={field.onChange}
              ownSlot={reservation?.slot_start}
              label={t('form.slot')}
              errorMessage={
                errors.slot_start?.message && t(`validation.${errors.slot_start.message}`)
              }
            />
          )}
        />
      </fieldset>

      <fieldset className={FIELDSET}>
        <legend className="sr-only">{t('form.services')}</legend>
        <Controller
          control={control}
          name="service_ids"
          render={({ field }) => (
            <CheckboxGroup
              label={t('form.services')}
              description={t('form.servicesHint')}
              value={field.value}
              onValueChange={field.onChange}
            >
              <ServiceGroups
                services={offered}
                isPackage={(service) => service.package}
                render={(service) => {
                  const reason = unavailableReason(unavailable.get(service.id));
                  return (
                    <Checkbox key={service.id} value={service.id} isDisabled={!!reason}>
                      <span className="flex flex-col">
                        {service.name}
                        {/* Spec 024, CA-23 to CA-25: why it cannot be chosen, read with its name. */}
                        {reason && <span className="text-xs text-default-500">{reason}</span>}
                      </span>
                    </Checkbox>
                  );
                }}
              />
            </CheckboxGroup>
          )}
        />
        <BookingEstimate services={ticked} />
        <Textarea
          {...register('notes', { maxLength: { value: 500, message: 'notesTooLong' } })}
          label={t('form.notes')}
          labelPlacement="outside"
          variant="bordered"
          minRows={2}
          isInvalid={!!errors.notes}
          errorMessage={errors.notes?.message && t(`validation.${errors.notes.message}`)}
        />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
          {reservation ? t('form.saveChanges') : t('form.save')}
        </Button>
        <Button as={Link} href="/my/reservations" variant="light">
          {t('form.cancel')}
        </Button>
      </div>
    </form>
  );
};

export default MyReservationForm;
