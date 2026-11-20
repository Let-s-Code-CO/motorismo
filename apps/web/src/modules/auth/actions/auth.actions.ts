'use server';

import { redirect } from 'next/navigation';

import { z } from 'zod';

import { clearActivityCookie, touchActivityCookie } from '@web/modules/auth/api/activity.server';
import { forgotPasswordSchema } from '@web/modules/auth/schemas/forgot-password.schema';
import { loginSchema } from '@web/modules/auth/schemas/login.schema';
import { setPasswordSchema } from '@web/modules/auth/schemas/set-password.schema';
import { signUpSchema } from '@web/modules/auth/schemas/sign-up.schema';
import { destinationAfterSignIn, sanitizeNextPath } from '@web/modules/auth/utils/access.utils';
import { type AuthErrorKey, mapAuthError } from '@web/modules/auth/utils/auth-errors.utils';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type { ActionResult } from '@web/modules/core/types/action-result.types';
import { getSiteUrl } from '@web/modules/core/utils/site-url.utils';

/** A sign-in that worked says where to go; one that did not, why (as any action). */
export type SignInResult =
  { ok: true; destination: string } | Exclude<ActionResult<AuthErrorKey>, { ok: true }>;

/**
 * Email + password sign-in (HU-01). On success, it answers where to go: the requested page or
 * home — for a customer, only a page of theirs (spec 004, RF-02); never another site. It does not
 * redirect itself, so the form can show the brand while that page loads (spec 011, CA-12); the
 * destination is still decided here, on the server.
 */
export const signIn = async (input: unknown, next?: string | null): Promise<SignInResult> => {
  const parsed = loginSchema.safeParse(input);
  // Same message as wrong credentials: nothing to learn from a malformed request (RN-06).
  if (!parsed.success) return { ok: false, error: 'invalidCredentials' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: mapAuthError(error.code) };

  // Spec 004, RF-02: a customer only goes to the requested page if it is theirs.
  const { data: account } = await supabase.rpc('current_account');
  await touchActivityCookie();
  return {
    ok: true,
    destination: destinationAfterSignIn(account?.[0]?.kind, sanitizeNextPath(next)),
  };
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

/**
 * Starts "Continuar con Google" (HU-06). Staff enter with their account; an unknown Google email
 * becomes a customer account (spec 004, CA-20 — the consent notice is shown next to the button).
 */
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

type SignUpErrorKey = 'invalidInput' | 'rateLimited' | 'generic';

/**
 * Customer sign-up with email and password (spec 004, HU-01). Auth sends the confirmation email
 * (CA-02); the customer exists once it is confirmed (CA-19). The form data and the consent travel
 * as metadata, and the database validates them again (RN-04, RN-03). An email that already has an
 * account gets the same answer as a new one (CA-07, RN-06): Auth changes nothing in that case.
 */
export const signUp = async (input: unknown): Promise<ActionResult<SignUpErrorKey>> => {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalidInput',
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const { email, password, full_name, phone, data_consent } = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name, phone: phone ?? null, data_consent },
      emailRedirectTo: `${getSiteUrl()}/auth/confirm`,
    },
  });

  if (!error || error.code === 'user_already_exists') return { ok: true };
  const key = mapAuthError(error.code);
  return { ok: false, error: key === 'rateLimited' ? 'rateLimited' : 'generic' };
};

/**
 * Re-sends the sign-up confirmation email (CA-04, CA-05). Like the password recovery, the answer
 * is always the same, so it cannot be used to discover which emails have a pending sign-up.
 */
export const resendConfirmation = async (rawEmail: string): Promise<ActionResult<never>> => {
  const parsed = forgotPasswordSchema.safeParse({ email: rawEmail });
  if (!parsed.success) return { ok: true };

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resend({
    type: 'signup',
    email: parsed.data.email,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/confirm` },
  });

  return { ok: true };
};
