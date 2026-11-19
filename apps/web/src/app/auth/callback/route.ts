import { type NextRequest, NextResponse } from 'next/server';

import { destinationAfterSignIn, sanitizeNextPath } from '@web/modules/auth/utils/access.utils';
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
} from '@web/modules/auth/utils/activity-cookie.utils';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

/**
 * Return point of "Continuar con Google" (HU-06). A new Google account arrives here as a customer
 * (spec 004, CA-20). Errors reported by Google or Auth (e.g. a disabled account, CA-28) go to the
 * login, which turns the code into a message.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const toLogin = (code: string) =>
    NextResponse.redirect(new URL(`/auth/login?error=${encodeURIComponent(code)}`, request.url));

  const providerError = searchParams.get('error_code') ?? searchParams.get('error');
  if (providerError) return toLogin(providerError);

  const code = searchParams.get('code');
  if (!code) return toLogin('oauth_failed');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return toLogin(error.code ?? 'oauth_failed');

  // Spec 004, RF-02: a customer only goes to the requested page if it is theirs.
  const { data: account } = await supabase.rpc('current_account');
  const destination = destinationAfterSignIn(
    account?.[0]?.kind,
    sanitizeNextPath(searchParams.get('next'))
  );
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions);
  return response;
};
