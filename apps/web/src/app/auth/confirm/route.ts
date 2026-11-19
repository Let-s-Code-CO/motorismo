import { type NextRequest, NextResponse } from 'next/server';

import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
} from '@web/modules/auth/utils/activity-cookie.utils';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

const LINK_TYPES = ['invite', 'recovery'] as const;

/**
 * Landing route of invitation and recovery emails (token_hash flow). A valid link opens a session
 * and leads to "create your password"; anything else leads to the invalid-link page for its type.
 */
export const GET = async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const type = LINK_TYPES.find((linkType) => linkType === searchParams.get('type'));

  const invalidLink = () =>
    NextResponse.redirect(
      new URL(type ? `/auth/invalid-link?type=${type}` : '/auth/invalid-link', request.url)
    );

  if (!type || !tokenHash) return invalidLink();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  // A disabled account gets no session; tell it why instead of "expired link" (CA-25).
  if (error?.code === 'user_banned') {
    return NextResponse.redirect(new URL('/auth/login?error=account_disabled', request.url));
  }
  if (error) return invalidLink();

  const response = NextResponse.redirect(new URL('/auth/set-password', request.url));
  response.cookies.set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions);
  return response;
};
