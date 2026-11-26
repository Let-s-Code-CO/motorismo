'use client';

import { useEffect, useState } from 'react';
import { Controller, type DefaultValues, type UseFormReturn, useWatch } from 'react-hook-form';

import { useTranslations } from 'next-intl';

import { useQuery } from '@tanstack/react-query';

import { Input, NumberInput, Radio, RadioGroup } from '@heroui/react';

import CatalogAutocomplete from '@web/modules/vehicles/components/molecules/catalog-autocomplete.component';
import ColorSelect from '@web/modules/vehicles/components/molecules/color-select.component';
import PlateCityAutocomplete from '@web/modules/vehicles/components/molecules/plate-city-autocomplete.component';
import {
  CLASSES_BY_TYPE,
  DEFAULT_PLATE_CITY,
  DEFAULT_VEHICLE_TYPE,
  VEHICLE_TYPES,
} from '@web/modules/vehicles/constants/vehicle-options.constants';
import {
  brandsQueryOptions,
  linesQueryOptions,
  municipalitiesQueryOptions,
} from '@web/modules/vehicles/queries/vehicles.queries';
import type {
  VehicleFormInput,
  VehicleFormValues,
} from '@web/modules/vehicles/schemas/vehicle.schema';
import type { VehicleClass, VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import { catalogKey, findInCatalog } from '@web/modules/vehicles/utils/catalog-key.utils';
import { hasPlate } from '@web/modules/vehicles/utils/plate.utils';

/** A vehicle not registered yet: Motocicleta first, nothing else chosen (spec 005, CA-02). */
export const NEW_VEHICLE: DefaultValues<VehicleFormInput> = {
  vehicle_type: DEFAULT_VEHICLE_TYPE,
  vehicle_class: null,
  brand_name: '',
  line_name: '',
  displacement_cc: null,
  plate: '',
  plate_city_code: null,
};

const FIELD = {
  labelPlacement: 'outside',
  variant: 'bordered',
  validationBehavior: 'aria',
} as const;

type VehicleFieldsProps = {
  /** The form the fields belong to: «Mi vehículo» or the first vehicle of a new customer. */
  form: UseFormReturn<VehicleFormInput, unknown, VehicleFormValues>;
};

/**
 * The fields of a vehicle (spec 005, HU-01 / HU-05 / HU-06): type (Motocicleta first, CA-02), class
 * for cars and bicycles, brand and line from the catalog or new (HU-02), displacement for
 * motorcycles, colour (HU-03), plate except for bicycles (CA-06) and, for cars, the city that issued
 * it, Bogotá, D.C. by default (HU-07, CA-30). Changing the type empties brand, line and class and
 * resets the plate city; changing the brand empties the line (CA-09).
 * Shared by `VehicleForm` and by the new customer's first vehicle (spec 022, CA-05), so a vehicle has
 * the same fields and rules wherever it is registered. Its drop-downs are drawn inside it, so inside a
 * modal they stay visible to screen readers.
 */
const VehicleFields = ({ form }: VehicleFieldsProps) => {
  const t = useTranslations('vehicles');
  const [popoverRoot, setPopoverRoot] = useState<HTMLDivElement | null>(null);
  const portalContainer = popoverRoot ?? undefined;
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const type = useWatch({ control, name: 'vehicle_type' });
  const brandName = useWatch({ control, name: 'brand_name' }) ?? '';
  const brands = useQuery(brandsQueryOptions(type));
  const brand = findInCatalog(brands.data ?? [], brandName);
  const lines = useQuery({ ...linesQueryOptions(brand?.id ?? ''), enabled: !!brand });
  // RN-11: only cars have a plate city; the list is loaded the first time one is needed.
  const cities = useQuery({ ...municipalitiesQueryOptions(), enabled: type === 'car' });
  // Spec 023, CA-08: a car registered with a city that issues no plates (not offered any more) is
  // asked for its city again: the field starts empty and the form requires one.
  const cityCode = useWatch({ control, name: 'plate_city_code' });
  useEffect(() => {
    if (!cities.data || !cityCode) return;
    if (!cities.data.some(({ code }) => code === cityCode)) setValue('plate_city_code', null);
  }, [cities.data, cityCode, setValue]);
  const classes = CLASSES_BY_TYPE[type];

  const changeType = (next: VehicleType) => {
    setValue('vehicle_type', next);
    setValue('brand_name', '');
    setValue('line_name', '');
    setValue('vehicle_class', null);
    setValue('displacement_cc', null);
    // CA-09, CA-30: a car starts in Bogotá, D.C.; other types have no plate city.
    setValue('plate_city_code', next === 'car' ? DEFAULT_PLATE_CITY : null);
  };

  const changeBrand = (name: string) => {
    if (catalogKey(name) !== catalogKey(getValues('brand_name') ?? '')) setValue('line_name', '');
    setValue('brand_name', name, { shouldValidate: !!errors.brand_name });
  };

  const fieldError = (message?: string) => message && t(`validation.${message}`);

  const colorField = (
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
  );

  return (
    <>
      <div ref={setPopoverRoot} />
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
        {type !== 'car' && colorField}
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
        {type === 'car' && (
          <Controller
            control={control}
            name="plate_city_code"
            render={({ field }) => (
              <PlateCityAutocomplete
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                cities={cities.data ?? []}
                isLoading={cities.isLoading}
                portalContainer={portalContainer}
                isInvalid={!!errors.plate_city_code}
                errorMessage={fieldError(errors.plate_city_code?.message)}
              />
            )}
          />
        )}
        {/* A car keeps its plate and plate city side by side: its colour goes after them. */}
        {type === 'car' && colorField}
      </div>
    </>
  );
};

export default VehicleFields;
