'use server';

import { revalidatePath } from 'next/cache';

import { getActiveCustomer } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { myProfileSchema } from '@web/modules/customers/schemas/customer.schema';
import {
  type CustomersErrorKey,
  fromCustomerGuardError,
} from '@web/modules/customers/utils/customers-errors.utils';

const PROFILE_PATH = '/profile';
const CUSTOMERS_PATH = '/customers';

/**
 * "Mi perfil" (spec 004, HU-03): the customer changes their own name and phone (CA-13). Runs with
 * the customer's OWN session: RLS limits it to their row and the guard to those two columns
 * (CA-10, CA-14). The email is never sent (RN-10).
 */
export const updateMyProfile = async (input: unknown): Promise<ActionResult<CustomersErrorKey>> => {
  const customer = await getActiveCustomer();
  if (!customer) return { ok: false, error: 'forbidden' };

  const parsed = myProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .update({ full_name: parsed.data.full_name, phone: parsed.data.phone })
    .eq('id', customer.id)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: fromCustomerGuardError(error) };
  if (!data) return { ok: false, error: 'generic' };

  revalidatePath(PROFILE_PATH);
  revalidatePath(CUSTOMERS_PATH, 'layout');
  return { ok: true };
};
