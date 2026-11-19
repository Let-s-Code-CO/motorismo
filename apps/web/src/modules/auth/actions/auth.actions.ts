'use server';

import { redirect } from 'next/navigation';

import { clearActivityCookie, touchActivityCookie } from '@web/modules/auth/api/activity.server';
import { forgotPasswordSchema } from '@web/modules/auth/schemas/forgot-password.schema';
import { loginSchema } from '@web/modules/auth/schemas/login.schema';
import { setPasswordSchema } from '@web/modules/auth/schemas/set-password.schema';
import { sanitizeNextPath } from '@web/modules/auth/utils/access.utils';
import { type AuthErrorKey, mapAuthError } from '@web/modules/auth/utils/auth-errors.utils';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { getSiteUrl } from '@web/modules/core/utils/site-url.utils';

/** Email + password sign-in (HU-01). On success, goes to the requested page or home. */
export const signIn = async (
  input: unknown,
  next?: string | null
): Promise<ActionResult<AuthErrorKey>> => {
  const parsed = loginSchema.safeParse(input);
  // Same message as wrong credentials: nothing to learn from a malformed request (RN-06).
  if (!parsed.success) return { ok: false, error: 'invalidCredentials' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: mapAuthError(error.code) };

  await touchActivityCookie();
  redirect(sanitizeNextPath(next) ?? '/');
};

export const signOut = async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: 'local' });
  await clearActivityCookie();
  redirect('/auth/login');
};

/**
 * Sets the password of the session opened by an invitation or recovery link (CA-14, CA-23).
 * An invited user becomes active HERE, once Auth stored the password they chose: opening the link
 * is not enough (Auth already writes a random password on verify). The secret key performs only the
 * invited → active transition of this same user; users can never change their status via the API.
 */
export const setPassword = async (input: unknown): Promise<ActionResult<AuthErrorKey>> => {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'weakPassword' };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error || !data.user) return { ok: false, error: mapAuthError(error?.code) };

  await createSupabaseAdminClient()
    .from('profiles')
    .update({ status: 'active' })
    .eq('id', data.user.id)
    .eq('status', 'invited');

  await touchActivityCookie();
  redirect('/');
};

/**
 * Sends a recovery link (CA-22). The answer is the same whether or not the email exists and even
 * if Auth fails, so it cannot be used to discover registered emails (RN-06).
 */
export const requestPasswordReset = async (
  input: unknown
): Promise<ActionResult<'invalidInput'>> => {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'invalidInput', fieldErrors: { email: ['emailInvalid'] } };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: getSiteUrl() });

  return { ok: true };
};

/** Starts "Continuar con Google" (HU-06). Only already-invited emails get in (sign-up is disabled). */
export const signInWithGoogle = async (
  next?: string | null
): Promise<ActionResult<AuthErrorKey>> => {
  const safeNext = sanitizeNextPath(next);
  const callback = `${getSiteUrl()}/auth/callback${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ''}`;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: callback },
  });
  if (error || !data.url) return { ok: false, error: mapAuthError(error?.code) };

  redirect(data.url);
};
