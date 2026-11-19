'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveCustomer, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
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
export const saveVehicle = async (input: unknown): Promise<ActionResult<VehiclesErrorKey>> => {
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
  const { error } = await supabase.rpc('save_vehicle', {
    p_customer_id: customerId,
    p_vehicle_type: vehicle.vehicle_type,
    p_vehicle_class: vehicle.vehicle_class ?? undefined,
    p_brand_name: vehicle.brand_name,
    p_line_name: vehicle.line_name ?? undefined,
    p_displacement_cc: vehicle.displacement_cc ?? undefined,
    p_color: vehicle.color,
    p_plate: vehicle.plate ?? undefined,
    p_vehicle_id: vehicle.vehicle_id ?? undefined,
  });
  if (error) return { ok: false, error: fromVehicleError(error, who.audience) };

  revalidateVehicles(customerId);
  return { ok: true };
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
