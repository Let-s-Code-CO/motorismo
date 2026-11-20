'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { Alert, Button, Input } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Tag } from 'lucide-react';

import { formatAmount, parsePesos } from '@web/modules/core/utils/money.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { createService, updateService } from '@web/modules/services/actions/services.actions';
import type { ServiceRow } from '@web/modules/services/api/services.server';
import {
  type ServiceInput,
  type ServiceValues,
  serviceSchema,
} from '@web/modules/services/schemas/service.schema';
import type { ServicesErrorKey } from '@web/modules/services/utils/services-errors.utils';

type ServiceFormProps = {
  /** The service to correct; without it the form registers a new one. */
  service?: ServiceRow;
  onSaved: () => void;
  onCancel: () => void;
};

const PRICES = [
  { name: 'price_motorcycle', label: 'motorcycle' },
  { name: 'price_car', label: 'car' },
  { name: 'price_bicycle', label: 'bicycle' },
] as const;

const asText = (value: number | null | undefined) => (value == null ? '' : formatAmount(value));

/**
 * An admin registers or corrects a service (spec 007, HU-01): a name and a reference price for
 * each vehicle type it is offered for (CA-01, CA-02). Every problem shows next to its field
 * (CA-03); a name already taken is refused, suggesting to reactivate a disabled one (CA-04).
 */
const ServiceForm = ({ service, onSaved, onCancel }: ServiceFormProps) => {
  const t = useTranslations('services');
  const [serverError, setServerError] = useState<ServicesErrorKey>();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ServiceInput, unknown, ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? '',
      price_motorcycle: asText(service?.price_motorcycle),
      price_car: asText(service?.price_car),
      price_bicycle: asText(service?.price_bicycle),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await callAction(() =>
      service ? updateService({ id: service.id, ...values }) : createService(values)
    );
    if (!result) return; // No network (spec 006, CA-10): the app-wide notice speaks.
    if (result.ok) onSaved();
    else setServerError(result.error);
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);
  // «At least one price» belongs to the group, not to one field.
  const pricesError = (errors as Record<string, { message?: string } | undefined>).prices?.message;
  const pricesHintId = 'service-prices-hint';

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}
      <Input
        {...register('name')}
        label={t('form.name')}
        placeholder={t('form.namePlaceholder')}
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<Tag aria-hidden className="size-4 shrink-0 text-default-400" />}
        isInvalid={!!errors.name}
        errorMessage={fieldError(errors.name?.message)}
      />
      <fieldset className="flex flex-col gap-3" aria-describedby={pricesHintId}>
        <legend className="text-sm font-medium text-foreground">{t('form.prices')}</legend>
        <p id={pricesHintId} className="-mt-1 text-xs text-default-500">
          {t('form.pricesHint')}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PRICES.map(({ name, label }) => {
            const field = register(name);
            return (
              <Input
                key={name}
                {...field}
                // Show thousands separators once the value is typed: «25000» → «25.000».
                onBlur={(event) => {
                  const typed = event.target.value;
                  const amount = parsePesos(typed);
                  if (amount !== null) setValue(name, formatAmount(amount));
                  return field.onBlur(event);
                }}
                label={t(`form.${label}`)}
                placeholder={t('form.pricePlaceholder')}
                inputMode="numeric"
                variant="bordered"
                labelPlacement="outside"
                validationBehavior="aria"
                startContent={<span className="text-sm text-default-400">$</span>}
                isInvalid={!!errors[name]}
                errorMessage={fieldError(errors[name]?.message)}
              />
            );
          })}
        </div>
        {pricesError && (
          <p role="alert" className="text-xs text-danger">
            {fieldError(pricesError)}
          </p>
        )}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="light" onPress={onCancel}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" color="primary" className="font-medium" isLoading={isSubmitting}>
          {service ? t('form.submitEdit') : t('form.submitNew')}
        </Button>
      </div>
    </form>
  );
};

export default ServiceForm;
