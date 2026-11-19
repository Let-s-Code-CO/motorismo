import { z } from 'zod';

import { Constants } from '@motorismo/supabase/types';

import {
  CATALOG_NAME_MAX,
  CLASSES_BY_TYPE,
  DISPLACEMENT_RANGE,
} from '@web/modules/vehicles/constants/vehicle-options.constants';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import { hasPlate, isValidPlate, normalizePlate } from '@web/modules/vehicles/utils/plate.utils';

/**
 * The vehicle form (spec 005), shared by the browser and the Server Action. It mirrors the
 * database rules (vehicles_guard) so every problem shows next to its field (CA-07), and its
 * output keeps only what belongs to the type (CA-09). Errors are message keys under
 * `vehicles.validation`.
 */

const isFilled = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

const isType = (value: unknown): value is VehicleType =>
  typeof value === 'string' &&
  (Constants.public.Enums.vehicle_type as readonly string[]).includes(value);

/** Optional catalog name: blank → null (a bicycle without line). */
const optionalName = z
  .string()
  .nullish()
  .transform((raw) => raw?.trim().replace(/\s+/g, ' ') || null)
  .refine((name) => name === null || name.length <= CATALOG_NAME_MAX, { error: 'nameTooLong' });

/** The NumberInput gives NaN when emptied: no displacement (optional, RN-09). */
const displacementField = z.preprocess(
  (raw) => (raw === '' || raw === undefined || Number.isNaN(raw) ? null : raw),
  z
    .number({ error: 'displacementInvalid' })
    .int({ error: 'displacementInvalid' })
    .min(DISPLACEMENT_RANGE.min, { error: 'displacementInvalid' })
    .max(DISPLACEMENT_RANGE.max, { error: 'displacementInvalid' })
    .nullable()
);

/** Cross-field rules run even when other fields fail, so the form shows every problem at once. */
const always = { when: () => true };

export const vehicleFormSchema = z
  .object({
    vehicle_type: z.enum(Constants.public.Enums.vehicle_type),
    vehicle_class: z.enum(Constants.public.Enums.vehicle_class).nullish(),
    brand_name: z
      .string({ error: 'brandRequired' })
      .trim()
      .min(1, { error: 'brandRequired' })
      .max(CATALOG_NAME_MAX, { error: 'nameTooLong' }),
    line_name: optionalName,
    displacement_cc: displacementField,
    color: z.enum(Constants.public.Enums.vehicle_color, { error: 'colorRequired' }),
    plate: z.string().nullish(),
  })
  .refine(
    (data) => !isType(data.vehicle_type) || !hasPlate(data.vehicle_type) || isFilled(data.plate),
    {
      path: ['plate'],
      error: 'plateRequired',
      ...always,
    }
  )
  .refine(
    (data) =>
      !isType(data.vehicle_type) ||
      !hasPlate(data.vehicle_type) ||
      !isFilled(data.plate) ||
      isValidPlate(data.vehicle_type, data.plate),
    { path: ['plate'], error: 'plateInvalid', ...always }
  )
  .refine(
    (data) =>
      !isType(data.vehicle_type) || data.vehicle_type === 'bicycle' || isFilled(data.line_name),
    {
      path: ['line_name'],
      error: 'lineRequired',
      ...always,
    }
  )
  .refine(
    (data) =>
      !isType(data.vehicle_type) ||
      data.vehicle_type === 'motorcycle' ||
      (!!data.vehicle_class && CLASSES_BY_TYPE[data.vehicle_type].includes(data.vehicle_class)),
    { path: ['vehicle_class'], error: 'classRequired', ...always }
  )
  // CA-09: only what belongs to the type is kept (a stale value from the form is dropped).
  .transform((data) => ({
    vehicle_type: data.vehicle_type,
    vehicle_class: data.vehicle_type === 'motorcycle' ? null : (data.vehicle_class ?? null),
    brand_name: data.brand_name.replace(/\s+/g, ' '),
    line_name: data.line_name,
    displacement_cc: data.vehicle_type === 'motorcycle' ? data.displacement_cc : null,
    color: data.color,
    plate: hasPlate(data.vehicle_type) && data.plate ? normalizePlate(data.plate) : null,
  }));

export type VehicleFormInput = z.input<typeof vehicleFormSchema>;
export type VehicleFormValues = z.output<typeof vehicleFormSchema>;

/** What the Server Action receives: the form values plus whose vehicle it is (and which one). */
export const saveVehicleSchema = z.intersection(
  vehicleFormSchema,
  z.object({ customer_id: z.uuid(), vehicle_id: z.uuid().nullish() })
);
