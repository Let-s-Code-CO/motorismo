'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveCustomer, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  MOTORCYCLE_CATEGORIES,
  type MotorcycleCategory,
} from '@web/modules/vehicles/constants/motorcycle-categories.constants';
import { saveVehicleSchema } from '@web/modules/vehicles/schemas/vehicle.schema';
import type { VehiclesAudience } from '@web/modules/vehicles/types/vehicles.types';
import {
  type VehiclesErrorKey,
  fromVehicleError,
} from '@web/modules/vehicles/utils/vehicles-errors.utils';

/**
 * Who is acting: active staff (any customer) or an enabled customer (only their own record, whose
 * id comes from the session, never from the request: CA-26). Null = nobody allowed.
 */
const actor = async (): Promise<{
  audience: VehiclesAudience;
  ownCustomerId: string | null;
} | null> => {
  if (await getActiveStaff()) return { audience: 'staff', ownCustomerId: null };
  const customer = await getActiveCustomer();
  return customer ? { audience: 'customer', ownCustomerId: customer.id } : null;
};

const revalidateVehicles = (customerId: string) => {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath('/customers');
  revalidatePath('/profile');
};

/**
 * Registers or corrects a vehicle (spec 005, HU-01 / HU-05 / HU-06). The brand and line go BY
 * NAME: save_vehicle finds them in the catalog or adds them, in the same transaction as the
 * vehicle (CA-13, CA-14). Runs with the user's OWN session: RLS and the guard decide.
 */
export const saveVehicle = async (
  input: unknown
): Promise<{ ok: true; id: string } | Exclude<ActionResult<VehiclesErrorKey>, { ok: true }>> => {
  const who = await actor();
  if (!who) return { ok: false, error: 'forbidden' };

  const parsed = saveVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const vehicle = parsed.data;
  const customerId = who.ownCustomerId ?? vehicle.customer_id;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('save_vehicle', {
    p_customer_id: customerId,
    p_vehicle_type: vehicle.vehicle_type,
    p_vehicle_class: vehicle.vehicle_class ?? undefined,
    p_brand_name: vehicle.brand_name,
    p_line_name: vehicle.line_name ?? undefined,
    p_displacement_cc: vehicle.displacement_cc ?? undefined,
    p_color: vehicle.color,
    p_plate: vehicle.plate ?? undefined,
    p_vehicle_id: vehicle.vehicle_id ?? undefined,
    // RN-11: only a car has a plate city (the schema already drops it from other types).
    p_plate_city_code: vehicle.plate_city_code ?? undefined,
    // Spec 024, CA-03: staff write the motorcycle's own category (null: it follows its line's). A
    // customer never asks to (CA-05); the database refuses it anyway.
    p_set_category: who.audience === 'staff' && vehicle.set_category,
    p_motorcycle_category: vehicle.motorcycle_category ?? undefined,
  });
  if (error) return { ok: false, error: fromVehicleError(error, who.audience) };

  revalidateVehicles(customerId);
  // The id lets a work order pick the vehicle just registered (spec 008, CA-02).
  return { ok: true, id: data };
};

const retireSchema = z.object({ id: z.uuid() });

/**
 * Retires a vehicle (spec 005, CA-21 / CA-24): it stops being active, its plate is freed and it is
 * never deleted (RN-07). The database sets the date and refuses a retired one (CA-22) or one the
 * user may not change (RLS).
 */
export const retireVehicle = async (input: unknown): Promise<ActionResult<VehiclesErrorKey>> => {
  const who = await actor();
  if (!who) return { ok: false, error: 'forbidden' };

  const parsed = retireSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'notFound' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('vehicles')
    .update({ retired_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
    .select('customer_id')
    .maybeSingle();
  if (error) return { ok: false, error: fromVehicleError(error, who.audience) };
  if (!data) return { ok: false, error: 'notFound' };

  revalidateVehicles(data.customer_id);
  return { ok: true };
};

const vehicleCategorySchema = z.object({
  vehicle_id: z.uuid(),
  category: z.enum(MOTORCYCLE_CATEGORIES as [MotorcycleCategory, ...MotorcycleCategory[]]),
});

/**
 * Spec 024, CA-06: staff give a motorcycle without category its category from an order; it is kept
 * on the motorcycle. Only active staff get this far, and the database checks again (CA-05).
 */
export const setVehicleCategory = async (
  input: unknown
): Promise<ActionResult<VehiclesErrorKey>> => {
  if (!(await getActiveStaff())) return { ok: false, error: 'forbidden' };
  const parsed = vehicleCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_vehicle_category', {
    p_vehicle_id: parsed.data.vehicle_id,
    p_category: parsed.data.category,
  });
  if (error) return { ok: false, error: fromVehicleError(error, 'staff') };
  return { ok: true };
};
