'use client';

import { useCallback, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useQuery } from '@tanstack/react-query';

import { Alert, Button, Checkbox, CheckboxGroup, Input, Textarea } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';

import BookingEstimate from '@web/modules/core/components/booking-estimate.component';
import { notify } from '@web/modules/core/lib/toast.lib';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { saveReservation } from '@web/modules/reservations/actions/reservations.actions';
import SlotPicker from '@web/modules/reservations/components/molecules/slot-picker.component';
import {
  type ReservationInput,
  reservationSchema,
} from '@web/modules/reservations/schemas/reservations.schema';
import type {
  AgendaDay,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';
import { isAgendaDate } from '@web/modules/reservations/utils/agenda-date.utils';
import type { ReservationsErrorKey } from '@web/modules/reservations/utils/reservations-errors.utils';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import CustomerPicker from '@web/modules/work-orders/components/organisms/customer-picker.component';
import { activeServicesQueryOptions } from '@web/modules/work-orders/queries/work-orders.queries';
import type {
  PickerCustomer,
  PickerVehicle,
  ServiceOption,
} from '@web/modules/work-orders/types/work-orders.types';
import { isOffered } from '@web/modules/work-orders/utils/line-price.utils';

type ReservationFormProps = {
  /** The chosen day, with its slots: changing the day reloads it from the server. */
  day: AgendaDay;
  /** A slot chosen from the agenda («Reservar»). */
  initialStart?: string | null;
  /** The reservation being changed (CA-20); without it, a new one. */
  reservation?: ReservationSummary;
  /** Amendment HU-07: the customer it was opened for (CA-40), and their vehicle (CA-41). */
  initialCustomer?: PickerCustomer | null;
  initialVehicleId?: string | null;
};

/** The services a reservation can intend (CA-04): active, and offered for the vehicle's type. */
const servicesFor = (services: ServiceOption[], type: VehicleType | null) =>
  type ? services.filter((service) => isOffered(service, type)) : services;

/** The time a reservation being changed gave each service «a convenir» (spec 024, CA-14). */
const quotedMinutesOf = (reservation?: ReservationSummary) =>
  Object.fromEntries(
    (reservation?.service_ids ?? []).flatMap((id, index) => {
      const minutes = reservation?.service_minutes?.[index];
      return minutes == null ? [] : [[id, String(minutes)]];
    })
  );

/**
 * «Nueva reserva» and changing one (spec 012, HU-01, CA-20): who (registered right there if new,
 * CA-02), which vehicle if known (CA-01), the day and its slot with free seats (CA-03), the services
 * they want (CA-04) and notes. Saving books the seat (CA-05); a slot that filled up meanwhile is
 * said, and the slots come back up to date (CA-06). A service «a convenir» ticked asks for its time,
 * and the total estimate counts it (spec 024, CA-14).
 */
const ReservationForm = ({
  day,
  initialStart,
  reservation,
  initialCustomer = null,
  initialVehicleId = null,
}: ReservationFormProps) => {
  const t = useTranslations('reservations');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEdit = !!reservation;
  const [serverError, setServerError] = useState<ReservationsErrorKey>();
  const [customer, setCustomer] = useState<PickerCustomer | null>(
    reservation
      ? {
          id: reservation.customer_id ?? '',
          full_name: reservation.customer_name ?? '',
          phone: reservation.customer_phone,
          email: null,
        }
      : initialCustomer
  );
  const [vehicle, setVehicle] = useState<PickerVehicle | null>(null);
  const [vehicleTouched, setVehicleTouched] = useState(false);
  const services = useQuery(activeServicesQueryOptions());

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ReservationInput>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      customer_id: reservation?.customer_id ?? initialCustomer?.id ?? '',
      vehicle_id: reservation?.vehicle_id ?? null,
      slot_start:
        reservation?.slot_start ??
        (day.slots.some((slot) => slot.slot_start === initialStart) ? initialStart : '') ??
        '',
      service_ids: reservation?.service_ids ?? [],
      service_minutes: quotedMinutesOf(reservation),
      notes: reservation?.notes ?? '',
    },
  });
  const vehicleId = useWatch({ control, name: 'vehicle_id' });
  const ticked = useWatch({ control, name: 'service_ids' });
  const quotedMinutes = useWatch({ control, name: 'service_minutes' });

  const chooseCustomer = useCallback(
    (next: PickerCustomer | null) => {
      setCustomer(next);
      setValue('customer_id', next?.id ?? '', { shouldValidate: !!next });
    },
    [setValue]
  );
  const chooseVehicle = useCallback(
    (next: PickerVehicle | null) => {
      setVehicle(next);
      setVehicleTouched(true);
      setValue('vehicle_id', next?.id ?? null);
    },
    [setValue]
  );

  const goToDay = (date: string) => {
    if (!isAgendaDate(date) || date === day.date) return;
    setValue('slot_start', '');
    // Other parameters (`edit=1` when changing a reservation) stay.
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', date);
    params.delete('start');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() =>
      saveReservation({ ...values, ...(reservation ? { id: reservation.id } : {}) })
    );
    // No network (spec 006, CA-10): the app-wide notice speaks; the form stays as it was.
    if (!result) return;
    if (result.ok) {
      // Spec 013, CA-05: «Reserva guardada.» shows on the reservation, once.
      notify({ tone: 'success', text: t('detail.saved'), after: `/agenda/${result.id}` });
      router.push(`/agenda/${result.id}`);
      return;
    }
    setServerError(result.error);
    // CA-06: a slot that filled up meanwhile; the slots come back up to date.
    if (result.error === 'slotFull' || result.error === 'slotStarted') {
      setValue('slot_start', '');
      router.refresh();
    }
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);
  // In a change, the reservation's own vehicle stays until staff pick another one.
  const shownVehicleId = vehicleTouched
    ? (vehicleId ?? null)
    : (reservation?.vehicle_id ?? vehicleId ?? null);
  const vehicleType = vehicleTouched
    ? (vehicle?.vehicle_type ?? null)
    : (reservation?.vehicle_type ?? null);
  const offered = servicesFor(services.data ?? [], vehicleType);
  const tickedServices = (ticked ?? []).flatMap((id) => {
    const service = offered.find((candidate) => candidate.id === id);
    if (!service) return [];
    if (!service.on_quote) return [service];
    // Its time is the one typed for it, once it is a whole number.
    const typed = String(quotedMinutes?.[id] ?? '').trim();
    return [{ ...service, estimated_minutes: /^\d+$/.test(typed) ? Number(typed) : null }];
  });
  const quotedTicked = tickedServices.filter((service) => service.on_quote);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}

      <fieldset className="flex flex-col gap-3 rounded-large border border-divider bg-content1 p-5 shadow-small">
        <legend className="sr-only">{t('form.customer')}</legend>
        <CustomerPicker
          purpose="reservation"
          customerLocked={isEdit}
          initialVehicleId={isEdit ? null : initialVehicleId}
          customer={customer}
          vehicleId={shownVehicleId}
          onCustomerChange={chooseCustomer}
          onVehicleChange={chooseVehicle}
        />
        {errors.customer_id?.message && (
          <p className="text-sm text-danger">{fieldError(errors.customer_id.message)}</p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-large border border-divider bg-content1 p-5 shadow-small">
        <legend className="sr-only">{t('form.slot')}</legend>
        <Input
          type="date"
          label={t('form.date')}
          labelPlacement="outside"
          variant="bordered"
          className="sm:max-w-xs"
          defaultValue={day.date}
          onValueChange={goToDay}
        />
        <Controller
          control={control}
          name="slot_start"
          render={({ field }) => (
            <SlotPicker
              state={day.state}
              slots={day.slots}
              value={field.value || null}
              onChange={field.onChange}
              ownSlot={reservation?.slot_start}
              label={t('form.slot')}
              errorMessage={fieldError(errors.slot_start?.message)}
            />
          )}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-large border border-divider bg-content1 p-5 shadow-small">
        <legend className="sr-only">{t('form.services')}</legend>
        <Controller
          control={control}
          name="service_ids"
          render={({ field }) => (
            <CheckboxGroup
              label={t('form.services')}
              description={t('form.servicesHint')}
              value={field.value ?? []}
              onValueChange={field.onChange}
            >
              {offered.map((service) => (
                <Checkbox key={service.id} value={service.id}>
                  {service.name}
                </Checkbox>
              ))}
              {services.data && offered.length === 0 && (
                <p className="text-sm text-default-500">{t('form.noServices')}</p>
              )}
            </CheckboxGroup>
          )}
        />
        {quotedTicked.map((service) => {
          const error = errors.service_minutes?.[service.id]?.message;
          return (
            <Input
              key={service.id}
              {...register(`service_minutes.${service.id}`)}
              label={t('form.quotedMinutes', { name: service.name })}
              description={t('form.quotedMinutesHint')}
              labelPlacement="outside"
              variant="bordered"
              inputMode="numeric"
              className="sm:max-w-xs"
              classNames={{ input: 'tabular-nums' }}
              isInvalid={!!error}
              errorMessage={fieldError(error)}
            />
          );
        })}
        <BookingEstimate services={tickedServices} />
        <Textarea
          {...register('notes')}
          label={t('form.notes')}
          labelPlacement="outside"
          variant="bordered"
          minRows={2}
          isInvalid={!!errors.notes}
          errorMessage={fieldError(errors.notes?.message)}
        />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
          {isEdit ? t('form.saveChanges') : t('form.save')}
        </Button>
        <Button
          as={Link}
          href={isEdit ? `/agenda/${reservation.id}` : `/agenda?date=${day.date}`}
          variant="light"
        >
          {t('form.cancel')}
        </Button>
      </div>
    </form>
  );
};

export default ReservationForm;
