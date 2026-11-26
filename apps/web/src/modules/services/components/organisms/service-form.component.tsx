'use client';

import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import {
  Alert,
  Button,
  Checkbox,
  CheckboxGroup,
  Input,
  Radio,
  RadioGroup,
  Switch,
  Textarea,
} from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Clock, Tag } from 'lucide-react';

import { formatAmount, parsePesos } from '@web/modules/core/utils/money.utils';
import { callAction } from '@web/modules/pwa/utils/call-action.utils';
import { createService, updateService } from '@web/modules/services/actions/services.actions';
import type { ServiceRow } from '@web/modules/services/api/services.server';
import {
  type ServiceInput,
  type ServiceValues,
  serviceSchema,
} from '@web/modules/services/schemas/service.schema';
import { closureOf } from '@web/modules/services/utils/service-combination.utils';
import type { ServicesErrorKey } from '@web/modules/services/utils/services-errors.utils';
import { MOTORCYCLE_CATEGORIES } from '@web/modules/vehicles/constants/motorcycle-categories.constants';

type ServiceFormProps = {
  /** The service to correct; without it the form registers a new one. */
  service?: ServiceRow;
  /** The catalog, to choose what the service includes (spec 024, CA-20). */
  catalog?: ServiceRow[];
  onSaved: () => void;
  onCancel: () => void;
};

const OTHER_PRICES = [
  { name: 'price_car', label: 'car' },
  { name: 'price_bicycle', label: 'bicycle' },
] as const;

const asText = (value: number | null | undefined) => (value == null ? '' : formatAmount(value));

/**
 * An admin registers or corrects a service (spec 007, HU-01; spec 024): a name, an optional
 * description (CA-19), and a reference price for each vehicle type it is offered for (CA-01, CA-02),
 * the motorcycle's single or one per category (CA-07); or «a convenir», without values nor time
 * (CA-12). Every problem shows next to its field (CA-03, CA-08); a name already taken is refused,
 * suggesting to reactivate a disabled one (CA-04).
 */
const ServiceForm = ({ service, catalog = [], onSaved, onCancel }: ServiceFormProps) => {
  const t = useTranslations('services');
  const tv = useTranslations('vehicles');
  const [serverError, setServerError] = useState<ServicesErrorKey>();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ServiceInput, unknown, ServiceValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? '',
      description: service?.description ?? '',
      on_quote: service?.on_quote ?? false,
      motorcycle_mode: service?.motorcycle_prices ? 'category' : 'single',
      price_motorcycle: asText(service?.price_motorcycle),
      motorcycle_prices: Object.fromEntries(
        MOTORCYCLE_CATEGORIES.map((category) => [
          category,
          asText(service?.motorcycle_prices?.[category]),
        ])
      ),
      price_car: asText(service?.price_car),
      price_bicycle: asText(service?.price_bicycle),
      estimated_minutes:
        service?.estimated_minutes == null ? '' : String(service.estimated_minutes),
      includes: service?.includes.map(({ id }) => id) ?? [],
    },
  });
  const onQuote = useWatch({ control, name: 'on_quote' });
  const combinable = catalog.map((option) => ({
    id: option.id,
    name: option.name,
    package: !!option.motorcycle_prices,
    includes: option.includes.map(({ id }) => id),
  }));
  const includable = catalog.filter(
    (option) =>
      !option.disabled_at &&
      option.id !== service?.id &&
      !(service && closureOf(option.id, combinable).has(service.id))
  );
  const motorcycleMode = useWatch({ control, name: 'motorcycle_mode' });

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
  const categoryErrors = errors.motorcycle_prices as
    Record<string, { message?: string } | undefined> | undefined;
  const pricesHintId = 'service-prices-hint';

  /** A price field: shows thousands separators once the value is typed («25000» → «25.000»). */
  const priceInput = (
    name: 'price_motorcycle' | 'price_car' | 'price_bicycle' | `motorcycle_prices.${string}`,
    label: string,
    message?: string
  ) => {
    const field = register(name as 'price_motorcycle');
    return (
      <Input
        key={name}
        {...field}
        onBlur={(event) => {
          const amount = parsePesos(event.target.value);
          if (amount !== null) setValue(name as 'price_motorcycle', formatAmount(amount));
          return field.onBlur(event);
        }}
        label={label}
        placeholder={t('form.pricePlaceholder')}
        inputMode="numeric"
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        startContent={<span className="text-sm text-default-400">$</span>}
        isInvalid={!!message}
        errorMessage={fieldError(message)}
      />
    );
  };

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
      <Textarea
        {...register('description')}
        label={t('form.description')}
        description={t('form.descriptionHint')}
        variant="bordered"
        labelPlacement="outside"
        validationBehavior="aria"
        minRows={2}
        isInvalid={!!errors.description}
        errorMessage={fieldError(errors.description?.message)}
      />
      {/* Spec 024, CA-12: «A convenir» hides the values and the time. */}
      <Controller
        control={control}
        name="on_quote"
        render={({ field }) => (
          <Switch
            isSelected={!!field.value}
            onValueChange={field.onChange}
            size="sm"
            classNames={{ label: 'flex flex-col gap-0.5' }}
          >
            <span className="text-sm font-medium text-foreground">{t('form.onQuote')}</span>
            <span className="text-xs text-default-500">{t('form.onQuoteHint')}</span>
          </Switch>
        )}
      />
      {!onQuote && (
        <fieldset className="flex flex-col gap-3" aria-describedby={pricesHintId}>
          <legend className="text-sm font-medium text-foreground">{t('form.prices')}</legend>
          <p id={pricesHintId} className="-mt-1 text-xs text-default-500">
            {t('form.pricesHint')}
          </p>
          {/* Spec 024, CA-07: the motorcycle's value, single or one per category. */}
          <Controller
            control={control}
            name="motorcycle_mode"
            render={({ field }) => (
              <RadioGroup
                label={t('form.motorcycleMode')}
                orientation="horizontal"
                value={field.value ?? 'single'}
                onValueChange={field.onChange}
                classNames={{ label: 'text-sm text-foreground', wrapper: 'gap-x-5' }}
              >
                <Radio value="single">{t('form.single')}</Radio>
                <Radio value="category" description={t('form.byCategoryHint')}>
                  {t('form.byCategory')}
                </Radio>
              </RadioGroup>
            )}
          />
          {motorcycleMode === 'category' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {MOTORCYCLE_CATEGORIES.map((category) =>
                priceInput(
                  `motorcycle_prices.${category}`,
                  tv(`categories.${category}`),
                  categoryErrors?.[category]?.message
                )
              )}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {motorcycleMode !== 'category' &&
              priceInput(
                'price_motorcycle',
                t('form.motorcycle'),
                errors.price_motorcycle?.message
              )}
            {OTHER_PRICES.map(({ name, label }) =>
              priceInput(name, t(`form.${label}`), errors[name]?.message)
            )}
          </div>
          {pricesError && (
            <p role="alert" className="text-xs text-danger">
              {fieldError(pricesError)}
            </p>
          )}
        </fieldset>
      )}
      {!onQuote && (
        <Input
          {...register('estimated_minutes')}
          label={t('form.minutes')}
          description={t('form.minutesHint')}
          inputMode="numeric"
          variant="bordered"
          labelPlacement="outside"
          validationBehavior="aria"
          className="sm:max-w-xs"
          startContent={<Clock aria-hidden className="size-4 shrink-0 text-default-400" />}
          isInvalid={!!errors.estimated_minutes}
          errorMessage={fieldError(errors.estimated_minutes?.message)}
        />
      )}
      {/* Spec 024, CA-20: the other active services, never one that already includes this one. */}
      {!onQuote && includable.length > 0 && (
        <Controller
          control={control}
          name="includes"
          render={({ field }) => (
            <CheckboxGroup
              label={t('form.includes')}
              description={t('form.includesHint')}
              value={field.value ?? []}
              onValueChange={field.onChange}
              classNames={{ wrapper: 'grid gap-x-4 gap-y-2 sm:grid-cols-2' }}
            >
              {includable.map((option) => (
                <Checkbox key={option.id} value={option.id}>
                  {option.name}
                </Checkbox>
              ))}
            </CheckboxGroup>
          )}
        />
      )}
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
