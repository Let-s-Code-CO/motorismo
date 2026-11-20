'use client';

import { useState } from 'react';
import { Controller, type DefaultValues, useForm, useWatch } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Button, Input, NumberInput, Radio, RadioGroup } from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';

import { saveVehicle } from '@web/modules/vehicles/actions/vehicles.actions';
import type { VehicleView } from '@web/modules/vehicles/api/vehicles.server';
import CatalogAutocomplete from '@web/modules/vehicles/components/molecules/catalog-autocomplete.component';
import ColorSelect from '@web/modules/vehicles/components/molecules/color-select.component';
import {
  CLASSES_BY_TYPE,
  DEFAULT_VEHICLE_TYPE,
  VEHICLE_TYPES,
} from '@web/modules/vehicles/constants/vehicle-options.constants';
import { vehicleKeys } from '@web/modules/vehicles/queries/vehicles.keys';
import {
  brandsQueryOptions,
  linesQueryOptions,
} from '@web/modules/vehicles/queries/vehicles.queries';
import {
  type VehicleFormInput,
  type VehicleFormValues,
  vehicleFormSchema,
} from '@web/modules/vehicles/schemas/vehicle.schema';
import type { VehicleClass, VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import { catalogKey, findInCatalog } from '@web/modules/vehicles/utils/catalog-key.utils';
import { formatPlate, hasPlate } from '@web/modules/vehicles/utils/plate.utils';
import type { VehiclesErrorKey } from '@web/modules/vehicles/utils/vehicles-errors.utils';

type VehicleFormProps = {
  customerId: string;
  /** The vehicle being corrected; absent to register a new one. */
  vehicle?: VehicleView;
  onSaved: () => void;
  onCancel: () => void;
};

const NEW_VEHICLE: DefaultValues<VehicleFormInput> = {
  vehicle_type: DEFAULT_VEHICLE_TYPE,
  vehicle_class: null,
  brand_name: '',
  line_name: '',
  displacement_cc: null,
  plate: '',
};

const fromVehicle = (vehicle: VehicleView): VehicleFormInput => ({
  vehicle_type: vehicle.vehicle_type,
  vehicle_class: vehicle.vehicle_class,
  brand_name: vehicle.brand?.name ?? '',
  line_name: vehicle.line?.name ?? '',
  displacement_cc: vehicle.displacement_cc,
  color: vehicle.color,
  plate: vehicle.plate ? formatPlate(vehicle.plate) : '',
});

const FIELD = {
  labelPlacement: 'outside',
  variant: 'bordered',
  validationBehavior: 'aria',
} as const;

/**
 * Registers or corrects a vehicle (spec 005, HU-01 / HU-05 / HU-06): type (Motocicleta first,
 * CA-02), class for cars and bicycles, brand and line from the catalog or new (HU-02), displacement
 * for motorcycles, colour (HU-03) and plate except for bicycles (CA-06). Changing the type empties
 * brand, line and class; changing the brand empties the line (CA-09).
 */
const VehicleForm = ({ customerId, vehicle, onSaved, onCancel }: VehicleFormProps) => {
  const t = useTranslations('vehicles');
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<VehiclesErrorKey>();
  // Drop-downs are drawn inside the form (so inside a modal they stay visible to screen readers).
  const [popoverRoot, setPopoverRoot] = useState<HTMLDivElement | null>(null);
  const portalContainer = popoverRoot ?? undefined;

  const {
    register,
    control,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormInput, unknown, VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: vehicle ? fromVehicle(vehicle) : NEW_VEHICLE,
  });

  const type = useWatch({ control, name: 'vehicle_type' });
  const brandName = useWatch({ control, name: 'brand_name' }) ?? '';
  const brands = useQuery(brandsQueryOptions(type));
  const brand = findInCatalog(brands.data ?? [], brandName);
  const lines = useQuery({ ...linesQueryOptions(brand?.id ?? ''), enabled: !!brand });
  const classes = CLASSES_BY_TYPE[type];

  const changeType = (next: VehicleType) => {
    setValue('vehicle_type', next);
    setValue('brand_name', '');
    setValue('line_name', '');
    setValue('vehicle_class', null);
    setValue('displacement_cc', null);
  };

  const changeBrand = (name: string) => {
    if (catalogKey(name) !== catalogKey(getValues('brand_name') ?? '')) setValue('line_name', '');
    setValue('brand_name', name, { shouldValidate: !!errors.brand_name });
  };

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await saveVehicle({
      ...values,
      customer_id: customerId,
      vehicle_id: vehicle?.id ?? null,
    });
    if (!result.ok) {
      setServerError(result.error);
      return;
    }
    // A new brand or line may have joined the catalog: suggest it from now on (CA-13).
    await queryClient.invalidateQueries({ queryKey: vehicleKeys.all });
    onSaved();
  });

  const fieldError = (message?: string) => message && t(`validation.${message}`);

  return (
    <form onSubmit={onSubmit} noValidate className="relative flex flex-col gap-5">
      <div ref={setPopoverRoot} />
      {serverError && <Alert color="danger" variant="faded" title={t(`errors.${serverError}`)} />}

      <RadioGroup
        label={t('form.type')}
        orientation="horizontal"
        value={type}
        onValueChange={(next) => changeType(next as VehicleType)}
        classNames={{ label: 'text-sm font-medium text-foreground' }}
      >
        {VEHICLE_TYPES.map((option) => (
          <Radio key={option} value={option}>
            {t(`types.${option}`)}
          </Radio>
        ))}
      </RadioGroup>

      {classes.length > 0 && (
        <Controller
          control={control}
          name="vehicle_class"
          render={({ field }) => (
            <RadioGroup
              label={t('form.class')}
              orientation="horizontal"
              value={field.value ?? ''}
              onValueChange={(next) => field.onChange(next as VehicleClass)}
              isInvalid={!!errors.vehicle_class}
              errorMessage={fieldError(errors.vehicle_class?.message)}
              validationBehavior="aria"
              classNames={{ label: 'text-sm font-medium text-foreground' }}
            >
              {classes.map((option) => (
                <Radio key={option} value={option}>
                  {t(`classes.${option}`)}
                </Radio>
              ))}
            </RadioGroup>
          )}
        />
      )}

      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Controller
          control={control}
          name="brand_name"
          render={({ field }) => (
            <CatalogAutocomplete
              label={t('form.brand')}
              placeholder={t('form.brandPlaceholder')}
              items={brands.data ?? []}
              isLoading={brands.isLoading}
              value={field.value ?? ''}
              onChange={changeBrand}
              onBlur={field.onBlur}
              portalContainer={portalContainer}
              isInvalid={!!errors.brand_name}
              errorMessage={fieldError(errors.brand_name?.message)}
            />
          )}
        />
        <Controller
          control={control}
          name="line_name"
          render={({ field }) => (
            <CatalogAutocomplete
              label={type === 'bicycle' ? t('form.lineOptional') : t('form.line')}
              placeholder={t('form.linePlaceholder')}
              items={brand ? (lines.data ?? []) : []}
              isLoading={!!brand && lines.isLoading}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              portalContainer={portalContainer}
              isInvalid={!!errors.line_name}
              errorMessage={fieldError(errors.line_name?.message)}
            />
          )}
        />
      </div>

      <div className="grid items-start gap-5 sm:grid-cols-2">
        {type === 'motorcycle' && (
          <Controller
            control={control}
            name="displacement_cc"
            render={({ field }) => (
              <NumberInput
                {...FIELD}
                label={t('form.displacement')}
                placeholder="150"
                hideStepper
                formatOptions={{ useGrouping: false, maximumFractionDigits: 0 }}
                endContent={
                  <span className="text-sm text-default-500">{t('form.displacementUnit')}</span>
                }
                value={typeof field.value === 'number' ? field.value : Number.NaN}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                isInvalid={!!errors.displacement_cc}
                errorMessage={fieldError(errors.displacement_cc?.message)}
              />
            )}
          />
        )}
        <Controller
          control={control}
          name="color"
          render={({ field }) => (
            <ColorSelect
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              portalContainer={portalContainer}
              isInvalid={!!errors.color}
              errorMessage={fieldError(errors.color?.message)}
            />
          )}
        />
        {hasPlate(type) && (
          <Input
            {...register('plate')}
            {...FIELD}
            label={t('form.plate')}
            placeholder={type === 'car' ? 'ABC-123' : 'UIH-03D'}
            description={type === 'car' ? t('form.plateHelpCar') : t('form.plateHelpMotorcycle')}
            autoCapitalize="characters"
            autoComplete="off"
            classNames={{ input: 'font-mono uppercase tracking-wider' }}
            isInvalid={!!errors.plate}
            errorMessage={fieldError(errors.plate?.message)}
          />
        )}
      </div>

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
