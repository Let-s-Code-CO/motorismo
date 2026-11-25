'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';
import Link from 'next/link';

import { Alert, Button, Checkbox, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Phone, User } from 'lucide-react';

import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { formatMobile } from '@web/modules/core/utils/phone.utils';
import { createCustomer, updateCustomer } from '@web/modules/customers/actions/customers.actions';
import {
  type NewCustomerInput,
  type NewCustomerValues,
  editCustomerSchema,
  newCustomerSchema,
} from '@web/modules/customers/schemas/customer.schema';
import type { CreateCustomerResult } from '@web/modules/customers/types/customers.types';
import type { CustomersErrorKey } from '@web/modules/customers/utils/customers-errors.utils';
import { prefillFromSearch } from '@web/modules/customers/utils/search-prefill.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import VehicleFields, {
  NEW_VEHICLE,
} from '@web/modules/vehicles/components/molecules/vehicle-fields.component';
import { DEFAULT_PLATE_CITY } from '@web/modules/vehicles/constants/vehicle-options.constants';
import {
  type VehicleFormInput,
  type VehicleFormValues,
  vehicleFormSchema,
} from '@web/modules/vehicles/schemas/vehicle.schema';
import type { VehiclesErrorKey } from '@web/modules/vehicles/utils/vehicles-errors.utils';

type Contact = { full_name: string; email: string | null; phone: string | null };

/** What registering or correcting answers (registering may refuse the first vehicle, spec 022). */
type SaveResult = CreateCustomerResult | ActionResult<CustomersErrorKey>;

/** The customer just registered, so a reservation can choose it (spec 012, CA-02). */
export type SavedCustomer = Contact & { id: string };

type CustomerFormProps = {
  /** In create mode it receives the new customer; in edit mode, nothing. */
  onSaved: (customer?: SavedCustomer) => void;
  onCancel?: () => void;
} & (
  | {
      mode: 'create';
      /** What staff searched without finding the customer: put in its field (spec 022, CA-04). */
      initialSearch?: string;
    }
  | {
      mode: 'edit';
      customerId: string;
      defaults: Contact;
      /** The customer has an account: their email is their login and cannot change (RN-10). */
      emailLocked: boolean;
    }
);

/**
 * Staff register a customer at the counter (spec 004, CA-24/CA-25, with the customer's consent) or
 * correct a customer's data (CA-27). The database refuses an email already in use (CA-26).
 * Registering, staff may add the customer's first vehicle with the vehicle's own fields and rules
 * (spec 022, CA-05): both are checked before sending and registered together or not at all (CA-07);
 * a plate already taken shows under «Placa». What was searched lands in its field (CA-04).
 */
const CustomerForm = (props: CustomerFormProps) => {
  const t = useTranslations('customers');
  const [serverError, setServerError] = useState<CustomersErrorKey>();
  const isCreate = props.mode === 'create';
  const emailLocked = props.mode === 'edit' && props.emailLocked;
  const defaults = props.mode === 'edit' ? props.defaults : undefined;
  const prefill = props.mode === 'create' ? prefillFromSearch(props.initialSearch ?? '') : {};
  const [withVehicle, setWithVehicle] = useState(!!prefill.vehicle);
  const [vehicleError, setVehicleError] = useState<VehiclesErrorKey>();
  const tVehicles = useTranslations('vehicles');
  const vehicleForm = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      ...NEW_VEHICLE,
      ...(prefill.vehicle && {
        vehicle_type: prefill.vehicle.vehicle_type,
        plate: prefill.vehicle.plate,
        // As changing the type to Carro does (spec 005, CA-30): Bogotá, D.C. by default.
        plate_city_code: prefill.vehicle.vehicle_type === 'car' ? DEFAULT_PLATE_CITY : null,
      }),
    },
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewCustomerInput, unknown, NewCustomerValues>({
    // In edit mode the consent was given when the customer was registered.
    resolver: zodResolver(
      (isCreate ? newCustomerSchema : editCustomerSchema) as typeof newCustomerSchema
    ),
    defaultValues: {
      full_name: defaults?.full_name ?? prefill.full_name ?? '',
      email: defaults?.email ?? '',
      phone: defaults?.phone ? formatMobile(defaults.phone) : (prefill.phone ?? ''),
    },
  });

  const saveCustomer = handleSubmit(async (values) => {
    setServerError(undefined);
    setVehicleError(undefined);
    // CA-07: the vehicle is checked with its own rules before anything is sent.
    const vehicle = withVehicle ? vehicleFormSchema.safeParse(vehicleForm.getValues()) : null;
    if (vehicle && !vehicle.success) return;
    const result = await callAction((): Promise<SaveResult> =>
      props.mode === 'create'
        ? createCustomer(vehicle ? { ...values, vehicle: vehicle.data } : values)
        : updateCustomer({
            id: props.customerId,
            full_name: values.full_name,
            email: values.email,
            phone: values.phone,
          })
    );
    // No network (spec 006, CA-10): the app-wide notice speaks; the form stays as it was.
    if (!result) return;
    if (result.ok) {
      props.onSaved(
        'id' in result && typeof result.id === 'string'
          ? { id: result.id, full_name: values.full_name, email: values.email, phone: values.phone }
          : undefined
      );
    } else if (result.error === 'vehicle') {
      // A plate already taken is fixed where it was typed; another refusal, in the vehicle's part.
      if (result.vehicleError === 'plateTaken') {
        vehicleForm.setError('plate', { message: 'plateTaken' }, { shouldFocus: true });
      } else setVehicleError(result.vehicleError);
    } else setServerError(result.error);
  });

  // Every error at once: the vehicle's fields are checked alongside the customer's.
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (withVehicle) await vehicleForm.trigger();
    await saveCustomer(event);
  };

  const fieldError = (message?: string) => message && t(`validation.${message}`);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}
      <Input
        {...register('full_name')}
        label={t('form.fullName')}
        placeholder={t('form.fullNamePlaceholder')}
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<User aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.full_name}
        errorMessage={fieldError(errors.full_name?.message)}
      />
      <Input
        {...register('email')}
        type="email"
        label={t('form.email')}
        placeholder={t('form.emailPlaceholder')}
        variant={emailLocked ? 'flat' : 'bordered'}
        labelPlacement="outside"
        validationBehavior="aria"
        isReadOnly={emailLocked}
        description={emailLocked ? t('detail.emailLocked') : undefined}
        startContent={<Mail aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.email}
        errorMessage={fieldError(errors.email?.message)}
      />
      <Input
        {...register('phone')}
        type="tel"
        inputMode="tel"
        label={t('form.phone')}
        placeholder={t('form.phonePlaceholder')}
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<Phone aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.phone}
        errorMessage={fieldError(errors.phone?.message)}
      />
      {isCreate && (
        <Controller
          control={control}
          name="data_consent"
          render={({ field }) => (
            <div className="flex flex-col gap-1">
              <Checkbox
                name={field.name}
                isSelected={field.value === true}
                onValueChange={(checked) => field.onChange(checked ? true : undefined)}
                onBlur={field.onBlur}
                size="sm"
                isInvalid={!!errors.data_consent}
                aria-describedby={errors.data_consent ? 'customer-consent-error' : undefined}
                classNames={{ label: 'text-sm text-default-600' }}
              >
                {t.rich('form.consent', {
                  link: (chunks) => (
                    <Link
                      href="/privacy"
                      target="_blank"
                      className="font-medium text-foreground underline underline-offset-4"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </Checkbox>
              {errors.data_consent?.message && (
                <p id="customer-consent-error" className="text-tiny text-danger">
                  {fieldError(errors.data_consent.message)}
                </p>
              )}
            </div>
          )}
        />
      )}
      {isCreate && (
        <Checkbox
          isSelected={withVehicle}
          onValueChange={setWithVehicle}
          size="sm"
          classNames={{ label: 'text-sm' }}
        >
          {t('form.withVehicle')}
        </Checkbox>
      )}
      {isCreate && withVehicle && (
        <fieldset className="flex flex-col gap-5 rounded-large border border-divider p-4">
          <legend className="px-1 text-sm font-semibold">{t('form.vehicleTitle')}</legend>
          {vehicleError && (
            <Alert color="danger" variant="faded" title={tVehicles(`errors.${vehicleError}`)} />
          )}
          <VehicleFields form={vehicleForm} />
        </fieldset>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        {props.onCancel && (
          <Button variant="light" onPress={props.onCancel}>
            {t('form.cancel')}
          </Button>
        )}
        <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
          {isCreate ? t('form.submit') : t('detail.save')}
        </Button>
      </div>
    </form>
  );
};

export default CustomerForm;
