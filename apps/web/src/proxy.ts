import { type NextRequest, NextResponse } from 'next/server';

import { decideAccess } from '@web/modules/auth/utils/access.utils';
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  parseLastSeen,
} from '@web/modules/auth/utils/activity-cookie.utils';
import { createSupabaseProxyClient } from '@web/modules/core/lib/supabase-proxy.lib';

/**
 * Runs before EVERY request, including client navigations and Server Actions (spec 002):
 * refreshes the Supabase session, reads the user's current status from the database (never from
 * the JWT, so a role change or a disabled account applies on the next action) and applies
 * `decideAccess`. Pages and actions check permissions again; RLS is the last line.
 */
export const proxy = async (request: NextRequest) => {
  const { supabase, getResponse } = createSupabaseProxyClient(request);

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;

  let profile = null;
  if (userId) {
    const { data: row } = await supabase
      .from('profiles')
      .select('status')
      .eq('id', userId)
      .maybeSingle();
    profile = row;
  }

  const now = Date.now();
  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasSession: Boolean(userId),
    profile,
    lastSeenAt: parseLastSeen(request.cookies.get(ACTIVITY_COOKIE)?.value),
    now,
  });

  if (decision.type === 'allow') {
    const response = getResponse();
    if (decision.touchActivity) {
      response.cookies.set(ACTIVITY_COOKIE, String(now), activityCookieOptions);
    }
    return response;
  }

  if (decision.signOut) await supabase.auth.signOut({ scope: 'local' });

  const redirect = NextResponse.redirect(new URL(decision.to, request.url));
  // Keep the cookies Supabase wrote (refreshed or cleared session).
  getResponse()
    .cookies.getAll()
    .forEach((cookie) => redirect.cookies.set(cookie));
  if (decision.signOut) redirect.cookies.delete(ACTIVITY_COOKIE);
  return redirect;
};

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
