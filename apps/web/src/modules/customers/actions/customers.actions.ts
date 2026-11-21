'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveCustomer, getActiveStaff } from '@web/modules/auth/api/auth.server';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  editCustomerSchema,
  myProfileSchema,
  newCustomerSchema,
} from '@web/modules/customers/schemas/customer.schema';
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

/** Auth ban long enough to be permanent until an admin reactivates (876000 h = 100 years). */
const BAN_FOREVER = '876000h';

const fieldErrorsOf = (error: z.ZodError) => z.flattenError(error).fieldErrors;

/**
 * Staff register a customer who arrives without an account (spec 004, CA-24). Only the contact data
 * is sent, with the staff member's OWN session: the database sets the counter origin, who
 * registered the customer and the consent date, and refuses an email already in use (CA-26).
 */
export const createCustomer = async (
  input: unknown
): Promise<{ ok: true; id: string } | Exclude<ActionResult<CustomersErrorKey>, { ok: true }>> => {
  const staff = await getActiveStaff();
  if (!staff) return { ok: false, error: 'forbidden' };

  const parsed = newCustomerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalidInput', fieldErrors: fieldErrorsOf(parsed.error) };
  }
  const { full_name, email, phone } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('customers')
    .insert({ full_name, email, phone })
    .select('id')
    .single();
  if (error) return { ok: false, error: fromCustomerGuardError(error) };

  revalidatePath(CUSTOMERS_PATH, 'layout');
  // Spec 012, CA-02: a reservation chooses the customer it has just registered.
  return { ok: true, id: data.id };
};

const customerIdSchema = z.object({ id: z.uuid() });

/**
 * Staff correct a customer's data (spec 004, CA-27): name and phone always; the email only for a
 * customer without account — the email of an account is its login and is never sent (RN-10).
 */
export const updateCustomer = async (input: unknown): Promise<ActionResult<CustomersErrorKey>> => {
  const staff = await getActiveStaff();
  if (!staff) return { ok: false, error: 'forbidden' };

  const id = customerIdSchema.safeParse(input);
  const parsed = editCustomerSchema.safeParse(input);
  if (!id.success) return { ok: false, error: 'notFound' };
  if (!parsed.success) {
    return { ok: false, error: 'invalidInput', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from('customers')
    .select('user_id')
    .eq('id', id.data.id)
    .maybeSingle();
  if (!current) return { ok: false, error: 'notFound' };

  const { full_name, email, phone } = parsed.data;
  const changes = current.user_id ? { full_name, phone } : { full_name, email, phone };
  const { data, error } = await supabase
    .from('customers')
    .update(changes)
    .eq('id', id.data.id)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: fromCustomerGuardError(error) };
  if (!data) return { ok: false, error: 'notFound' };

  revalidatePath(CUSTOMERS_PATH, 'layout');
  return { ok: true };
};

const setDisabledSchema = z.object({ id: z.uuid(), disabled: z.boolean() });

/**
 * Disables or reactivates a customer (spec 004, CA-29 / CA-30). Active staff, operator or admin
 * (RN-09); the database refuses anyone else too (CA-31). The customer record is the source of truth (the proxy
 * signs a disabled customer out on their next request); for a customer with an account, the Auth
 * ban additionally stops any NEW session. If Auth fails, the record goes back to how it was.
 */
export const setCustomerDisabled = async (
  input: unknown
): Promise<ActionResult<CustomersErrorKey>> => {
  const staff = await getActiveStaff();
  if (!staff) return { ok: false, error: 'forbidden' };

  const parsed = setDisabledSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };
  const { id, disabled } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from('customers')
    .select('user_id, disabled_at')
    .eq('id', id)
    .maybeSingle();
  if (!current) return { ok: false, error: 'notFound' };

  const setDisabledAt = (value: string | null) =>
    supabase
      .from('customers')
      .update({ disabled_at: value })
      .eq('id', id)
      .select('id')
      .maybeSingle();

  const { data, error } = await setDisabledAt(disabled ? new Date().toISOString() : null);
  if (error) return { ok: false, error: fromCustomerGuardError(error) };
  if (!data) return { ok: false, error: 'generic' };

  if (current.user_id) {
    const { error: banError } = await createSupabaseAdminClient().auth.admin.updateUserById(
      current.user_id,
      { ban_duration: disabled ? BAN_FOREVER : 'none' }
    );
    if (banError) {
      await setDisabledAt(current.disabled_at);
      return { ok: false, error: 'generic' };
    }
  }

  revalidatePath(CUSTOMERS_PATH, 'layout');
  return { ok: true };
};
