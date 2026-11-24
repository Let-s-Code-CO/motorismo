'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin, getActiveCustomer } from '@web/modules/auth/api/auth.server';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import {
  answerSchema,
  correctionSchema,
  emailSchema,
  erasureSchema,
  registerSchema,
} from '@web/modules/data-rights/schemas/data-rights.schema';
import {
  type DataRightsErrorKey,
  fromDataRightsError,
} from '@web/modules/data-rights/utils/data-rights-errors.utils';

type Result = ActionResult<DataRightsErrorKey>;

const MY_DATA_PATH = '/my/data';
const REQUESTS_PATH = '/admin/data-requests';

const idSchema = z.object({ id: z.uuid() });
const customerIdSchema = z.object({ customerId: z.uuid() });

const forbidden: Result = { ok: false, error: 'forbidden' };
const invalid: Result = { ok: false, error: 'invalidInput' };

/** Calls a data request function with the session's own rights; the database checks them again. */
const call = async (
  fn:
    | 'request_data_change'
    | 'withdraw_data_request'
    | 'register_data_request'
    | 'resolve_data_request'
    | 'reject_data_request'
    | 'erase_customer_data',
  args: Record<string, unknown>
): Promise<Result> => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(fn, args as never);
  return error ? { ok: false, error: fromDataRightsError(error) } : { ok: true };
};

// The customer (spec 017, HU-02) ------------------------------------------------------------------

/** CA-04: asks for a correction, saying what to correct. */
export const requestCorrection = async (input: unknown): Promise<Result> => {
  if (!(await getActiveCustomer())) return forbidden;
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const result = await call('request_data_change', {
    p_kind: 'correction',
    p_description: parsed.data.description,
  });
  if (result.ok) revalidatePath(MY_DATA_PATH);
  return result;
};

/** CA-05: asks for the erasure of their data, with an optional reason. */
export const requestErasure = async (input: unknown): Promise<Result> => {
  if (!(await getActiveCustomer())) return forbidden;
  const parsed = erasureSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const { reason } = parsed.data;
  const result = await call('request_data_change', {
    p_kind: 'erasure',
    ...(reason ? { p_description: reason } : {}),
  });
  if (result.ok) revalidatePath(MY_DATA_PATH);
  return result;
};

/** CA-08: withdraws one of their own open requests. */
export const withdrawDataRequest = async (input: unknown): Promise<Result> => {
  if (!(await getActiveCustomer())) return forbidden;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const result = await call('withdraw_data_request', { p_id: parsed.data.id });
  if (result.ok) revalidatePath(MY_DATA_PATH);
  return result;
};

// The admin (spec 017, HU-03, HU-04) ----------------------------------------------------------------

const afterAdmin = (customerId?: string) => {
  revalidatePath(REQUESTS_PATH, 'layout');
  if (customerId) revalidatePath(`/customers/${customerId}`);
};

/** CA-16: registers a request that came by the counter or Instagram. */
export const registerDataRequest = async (input: unknown): Promise<Result> => {
  if (!(await getActiveAdmin())) return forbidden;
  const customer = customerIdSchema.safeParse(input);
  const parsed = registerSchema.safeParse(input);
  if (!customer.success || !parsed.success) return invalid;
  const result = await call('register_data_request', {
    p_customer: customer.data.customerId,
    p_kind: parsed.data.kind,
    p_channel: parsed.data.channel,
    p_description: parsed.data.description,
  });
  if (result.ok) afterAdmin(customer.data.customerId);
  return result;
};

/** CA-11, CA-17: attends an inquiry or a correction, with the answer for the customer. */
export const resolveDataRequest = async (input: unknown): Promise<Result> => {
  if (!(await getActiveAdmin())) return forbidden;
  const id = idSchema.safeParse(input);
  const parsed = answerSchema.safeParse(input);
  if (!id.success || !parsed.success) return invalid;
  const result = await call('resolve_data_request', {
    p_id: id.data.id,
    p_response: parsed.data.response,
  });
  if (result.ok) afterAdmin();
  return result;
};

/** CA-14: rejects a request, with the reason. */
export const rejectDataRequest = async (input: unknown): Promise<Result> => {
  if (!(await getActiveAdmin())) return forbidden;
  const id = idSchema.safeParse(input);
  const parsed = answerSchema.safeParse(input);
  if (!id.success || !parsed.success) return invalid;
  const result = await call('reject_data_request', {
    p_id: id.data.id,
    p_reason: parsed.data.response,
  });
  if (result.ok) afterAdmin();
  return result;
};

/** CA-12: erases the customer's data (never with an open order, CA-13). */
export const eraseCustomerData = async (input: unknown): Promise<Result> => {
  if (!(await getActiveAdmin())) return forbidden;
  const parsed = idSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const result = await call('erase_customer_data', { p_request_id: parsed.data.id });
  if (result.ok) afterAdmin();
  return result;
};

/**
 * CA-11: changes a customer's email. With an account it is also the email they sign in with: Auth's
 * admin API changes it first (it keeps it in its identities too), then the record (whose guard keeps
 * it from the user's own session, spec 004 RN-10). A Google account's email is Google's (RN-08).
 */
export const correctCustomerEmail = async (input: unknown): Promise<Result> => {
  if (!(await getActiveAdmin())) return forbidden;
  const customer = customerIdSchema.safeParse(input);
  const parsed = emailSchema.safeParse(input);
  if (!customer.success || !parsed.success) return invalid;
  const { customerId } = customer.data;
  const { email } = parsed.data;

  const admin = createSupabaseAdminClient();
  const { data: record, error } = await admin
    .from('customers')
    .select('user_id, origin')
    .eq('id', customerId)
    .single();
  if (error || !record) return { ok: false, error: 'notFound' };
  if (record.origin === 'google') return { ok: false, error: 'googleEmail' };

  if (record.user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(record.user_id, {
      email,
      email_confirm: true,
    });
    if (authError) {
      return { ok: false, error: authError.code === 'email_exists' ? 'emailTaken' : 'generic' };
    }
  }
  const { error: updateError } = await admin
    .from('customers')
    .update({ email })
    .eq('id', customerId);
  if (updateError) return { ok: false, error: 'generic' };

  afterAdmin(customerId);
  return { ok: true };
};
