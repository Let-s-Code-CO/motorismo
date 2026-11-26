'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { serviceSchema } from '@web/modules/services/schemas/service.schema';
import {
  type ServicesErrorKey,
  fromServicesGuardError,
} from '@web/modules/services/utils/services-errors.utils';

const SERVICES_PATH = '/services';

const fieldErrorsOf = (error: z.ZodError) => z.flattenError(error).fieldErrors;

/**
 * An admin registers a service (spec 007, CA-01). Runs with the admin's OWN session: RLS lets only
 * an admin write (RN-01) and the guard refuses a name already taken, saying whether the existing
 * service is disabled (CA-04).
 */
export const createService = async (input: unknown): Promise<ActionResult<ServicesErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalidInput', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const { includes, ...service } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('services').insert(service).select('id').single();
  if (error) return { ok: false, error: fromServicesGuardError(error) };

  const included = await saveInclusions(supabase, data.id, includes);
  if (included) return { ok: false, error: included };

  revalidatePath(SERVICES_PATH);
  return { ok: true };
};

/** Spec 024, CA-20: what a service includes, replaced after the service is saved. */
const saveInclusions = async (
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  serviceId: string,
  includes: string[]
): Promise<ServicesErrorKey | null> => {
  const { error } = await supabase.rpc('set_service_inclusions', {
    p_service_id: serviceId,
    p_included: includes,
  });
  return error ? fromServicesGuardError(error) : null;
};

const idSchema = z.object({ id: z.uuid() });

/** An admin corrects the name or the prices of a service (CA-05): same rules as registering. */
export const updateService = async (input: unknown): Promise<ActionResult<ServicesErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const id = idSchema.safeParse(input);
  const parsed = serviceSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: parsed.success ? undefined : fieldErrorsOf(parsed.error),
    };
  }

  const { includes, ...service } = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('services')
    .update(service)
    .eq('id', id.data.id)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: fromServicesGuardError(error) };
  if (!data) return { ok: false, error: 'notFound' };

  const included = await saveInclusions(supabase, id.data.id, includes);
  if (included) return { ok: false, error: included };

  revalidatePath(SERVICES_PATH);
  return { ok: true };
};

const disableSchema = z.object({ id: z.uuid(), disabled: z.boolean() });

/**
 * An admin disables a service that is no longer offered, or reactivates it (CA-12, CA-13). It is
 * never deleted (RN-02): disabling keeps the date.
 */
export const setServiceDisabled = async (
  input: unknown
): Promise<ActionResult<ServicesErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = disableSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('services')
    .update({ disabled_at: parsed.data.disabled ? new Date().toISOString() : null })
    .eq('id', parsed.data.id)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: fromServicesGuardError(error) };
  if (!data) return { ok: false, error: 'notFound' };

  revalidatePath(SERVICES_PATH);
  return { ok: true };
};
