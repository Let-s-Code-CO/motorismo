import { type NextRequest, NextResponse } from 'next/server';

import { sanitizeNextPath } from '@web/modules/auth/utils/access.utils';
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
} from '@web/modules/auth/utils/activity-cookie.utils';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

/**
 * Return point of "Continuar con Google" (HU-06). Errors reported by Auth (unknown account, CA-27;
 * disabled account, CA-28) go to the login, which turns the code into a message.
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

  const destination = sanitizeNextPath(searchParams.get('next')) ?? '/';
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions);
  return response;
};
