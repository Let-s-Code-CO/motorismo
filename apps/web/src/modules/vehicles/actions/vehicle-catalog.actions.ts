'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  MOTORCYCLE_CATEGORIES,
  type MotorcycleCategory,
} from '@web/modules/vehicles/constants/motorcycle-categories.constants';
import { VEHICLE_TYPES } from '@web/modules/vehicles/constants/vehicle-options.constants';
import { catalogNameSchema } from '@web/modules/vehicles/schemas/vehicle-catalog.schema';
import {
  type VehicleCatalogErrorKey,
  fromVehicleCatalogError,
} from '@web/modules/vehicles/utils/vehicle-catalog-errors.utils';

type Result = ActionResult<VehicleCatalogErrorKey>;

const CATALOG_PATH = '/admin/vehicle-catalog';

const renameSchema = catalogNameSchema.extend({ id: z.uuid() });
const mergeSchema = z.object({ from: z.uuid(), into: z.uuid() });
const moveSchema = z.object({ lineId: z.uuid(), brandId: z.uuid() });
const addBrandSchema = catalogNameSchema.extend({
  type: z.enum(VEHICLE_TYPES as [string, ...string[]]),
});
const addLineSchema = catalogNameSchema.extend({ brandId: z.uuid() });
const idSchema = z.object({ id: z.uuid() });
const categorySchema = z.object({
  id: z.uuid(),
  category: z.enum(MOTORCYCLE_CATEGORIES as [MotorcycleCategory, ...MotorcycleCategory[]]),
});

const forbidden: Result = { ok: false, error: 'forbidden' };
const invalid: Result = { ok: false, error: 'invalidInput' };

/**
 * Calls a catalog function with the admin's own session: the database checks the role again (RN-01)
 * and refuses with a reason the screen says (spec 018).
 */
const call = async (
  fn:
    | 'add_vehicle_brand'
    | 'add_vehicle_line'
    | 'mark_vehicle_brand_reviewed'
    | 'mark_vehicle_line_reviewed'
    | 'rename_vehicle_brand'
    | 'rename_vehicle_line'
    | 'merge_vehicle_brands'
    | 'merge_vehicle_lines'
    | 'move_vehicle_line'
    | 'set_vehicle_line_category',
  args: Record<string, unknown>
): Promise<Result> => {
  if (!(await getActiveAdmin())) return forbidden;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(fn, args as never);
  if (error) return { ok: false, error: fromVehicleCatalogError(error) };
  revalidatePath(CATALOG_PATH);
  return { ok: true };
};

/** HU-02 (CA-07): a new name for a brand; the old one is remembered (CA-16). */
export const renameVehicleBrand = async (input: unknown): Promise<Result> => {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('rename_vehicle_brand', { p_brand_id: parsed.data.id, p_name: parsed.data.name });
};

/** HU-02 (CA-08): a new name for a line. */
export const renameVehicleLine = async (input: unknown): Promise<Result> => {
  const parsed = renameSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('rename_vehicle_line', { p_line_id: parsed.data.id, p_name: parsed.data.name });
};

/** HU-03 (CA-12, CA-13): a brand merges into another of its type, with its vehicles and lines. */
export const mergeVehicleBrands = async (input: unknown): Promise<Result> => {
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('merge_vehicle_brands', { p_from: parsed.data.from, p_into: parsed.data.into });
};

/** HU-03 (CA-14): a line merges into another of its brand, with its vehicles. */
export const mergeVehicleLines = async (input: unknown): Promise<Result> => {
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('merge_vehicle_lines', { p_from: parsed.data.from, p_into: parsed.data.into });
};

/** HU-04 (CA-18, CA-19): a line goes to another brand of its type, with its vehicles. */
export const moveVehicleLine = async (input: unknown): Promise<Result> => {
  const parsed = moveSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('move_vehicle_line', {
    p_line_id: parsed.data.lineId,
    p_brand_id: parsed.data.brandId,
  });
};

/** HU-06 (CA-26): a brand of a type that is missing, reviewed from the start. */
export const addVehicleBrand = async (input: unknown): Promise<Result> => {
  const parsed = addBrandSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('add_vehicle_brand', { p_type: parsed.data.type, p_name: parsed.data.name });
};

/** HU-06 (CA-27): a line of a brand that is missing, reviewed from the start. */
export const addVehicleLine = async (input: unknown): Promise<Result> => {
  const parsed = addLineSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('add_vehicle_line', { p_brand_id: parsed.data.brandId, p_name: parsed.data.name });
};

/** HU-06 (CA-29): a well written brand someone added is no longer to review. */
export const markVehicleBrandReviewed = async (input: unknown): Promise<Result> => {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('mark_vehicle_brand_reviewed', { p_brand_id: parsed.data.id });
};

/** HU-06 (CA-29): the same for a line. */
export const markVehicleLineReviewed = async (input: unknown): Promise<Result> => {
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('mark_vehicle_line_reviewed', { p_line_id: parsed.data.id });
};

/** Spec 024, CA-01: the category of a motorcycle line; the line is reviewed (spec 018, RN-07). */
export const setVehicleLineCategory = async (input: unknown): Promise<Result> => {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid;
  return call('set_vehicle_line_category', {
    p_line_id: parsed.data.id,
    p_category: parsed.data.category,
  });
};
