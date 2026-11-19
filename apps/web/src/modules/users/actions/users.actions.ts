'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { getSiteUrl } from '@web/modules/core/utils/site-url.utils';
import { inviteUserSchema } from '@web/modules/users/schemas/invite-user.schema';
import {
  changeRoleSchema,
  setUserStatusSchema,
} from '@web/modules/users/schemas/user-admin.schema';

/** Message keys under `users.errors`. */
export type UsersErrorKey =
  | 'forbidden'
  | 'invalidInput'
  | 'emailTaken'
  | 'notInvited'
  | 'lastAdmin'
  | 'selfChange'
  | 'rateLimited'
  | 'generic';

const USERS_PATH = '/admin/users';

/** Auth ban long enough to be permanent until an admin reactivates (876000 h = 100 years). */
const BAN_FOREVER = '876000h';

/** Database guard refusals (hints set by public.profiles_guard) → message keys. */
const fromGuardError = (error: { hint?: string | null }): UsersErrorKey => {
  if (error.hint === 'profile_last_admin') return 'lastAdmin';
  if (error.hint === 'profile_self_change') return 'selfChange';
  return 'generic';
};

/**
 * Invites someone by email (HU-03). Only an active admin may do it (CA-09).
 *
 * Spec 004: staff only come from a pending invitation (public.staff_invitations), written here with
 * the admin's OWN session so RLS checks it (admins only, signed as themselves). The database builds
 * the profile from that invitation when Auth creates the user — never from metadata, which anyone
 * can forge through the public sign-up (RN-11). If Auth fails, the invitation is withdrawn.
 */
export const inviteUser = async (input: unknown): Promise<ActionResult<UsersErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const { full_name, email, role } = parsed.data;

  const supabase = createSupabaseAdminClient();

  // Checked here because Auth re-sends the invitation to an unconfirmed email instead of failing;
  // email_in_use covers staff, pending invitations, customers and unconfirmed sign-ups (RN-01).
  const { data: inUse, error: lookupError } = await supabase.rpc('email_in_use', {
    p_email: email,
  });
  if (lookupError) return { ok: false, error: 'generic' };
  if (inUse) return { ok: false, error: 'emailTaken' };

  const session = await createSupabaseServerClient();
  const { error: invitationError } = await session
    .from('staff_invitations')
    .insert({ email, full_name, role, invited_by: admin.id });
  if (invitationError) return { ok: false, error: 'generic' };

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: getSiteUrl(),
  });
  if (error) {
    await session.from('staff_invitations').delete().eq('email', email);
    return { ok: false, error: error.code === 'email_exists' ? 'emailTaken' : 'generic' };
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
};

/** Sends a new invitation link to a user still "invited"; the previous link stops working (CA-16). */
export const resendInvite = async (userId: string): Promise<ActionResult<UsersErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const supabase = createSupabaseAdminClient();
  const { data: profile, error: lookupError } = await supabase
    .from('profiles')
    .select('email, status')
    .eq('id', userId)
    .maybeSingle();
  if (lookupError || !profile) return { ok: false, error: 'generic' };
  if (profile.status !== 'invited') return { ok: false, error: 'notInvited' };

  const { error } = await supabase.auth.admin.inviteUserByEmail(profile.email, {
    redirectTo: getSiteUrl(),
  });
  if (error) {
    return {
      ok: false,
      error: error.code === 'over_email_send_rate_limit' ? 'rateLimited' : 'generic',
    };
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
};

/**
 * Changes another user's role (CA-18). Runs with the admin's OWN session: RLS and the database
 * guard decide (no self-change, CA-10; one active admin must remain, CA-21).
 */
export const changeRole = async (input: unknown): Promise<ActionResult<UsersErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = changeRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };
  const { userId, role } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: fromGuardError(error) };
  if (!data) return { ok: false, error: 'generic' };

  revalidatePath(USERS_PATH);
  return { ok: true };
};

/**
 * Disables or reactivates another user (CA-19, CA-20). The profile status is the source of truth
 * (the proxy and RLS stop a disabled user on their next request); the Auth ban additionally stops
 * any NEW session. If Auth fails, the profile goes back to its previous status.
 * Reactivating someone who never accepted their invitation returns them to "invited" so it can be
 * re-sent (CA-29); the database refuses "active" for them anyway (RN-08).
 */
export const setUserStatus = async (input: unknown): Promise<ActionResult<UsersErrorKey>> => {
  const admin = await getActiveAdmin();
  if (!admin) return { ok: false, error: 'forbidden' };

  const parsed = setUserStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };
  const { userId, status } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: current } = await supabase
    .from('profiles')
    .select('status, activated_at')
    .eq('id', userId)
    .maybeSingle();
  if (!current) return { ok: false, error: 'generic' };

  const target = status === 'active' && !current.activated_at ? 'invited' : status;

  const updateStatus = (next: typeof current.status) =>
    supabase.from('profiles').update({ status: next }).eq('id', userId).select('id').maybeSingle();

  const { data, error } = await updateStatus(target);
  if (error) return { ok: false, error: fromGuardError(error) };
  if (!data) return { ok: false, error: 'generic' };

  const { error: banError } = await createSupabaseAdminClient().auth.admin.updateUserById(userId, {
    ban_duration: status === 'disabled' ? BAN_FOREVER : 'none',
  });
  if (banError) {
    await updateStatus(current.status);
    return { ok: false, error: 'generic' };
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
};
