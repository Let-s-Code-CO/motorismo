import { type NextRequest, NextResponse } from 'next/server';

import {
  type SessionAccount,
  decideAccess,
  toSessionAccount,
} from '@web/modules/auth/utils/access.utils';
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  parseLastSeen,
} from '@web/modules/auth/utils/activity-cookie.utils';
import { createSupabaseProxyClient } from '@web/modules/core/lib/supabase-proxy.lib';

/**
 * Runs before EVERY request, including client navigations and Server Actions (spec 002):
 * refreshes the Supabase session, reads the account (staff or customer, spec 004) and its current
 * status from the database (never from the JWT, so a role change or a disabled account applies on
 * the next action) and applies `decideAccess`. Pages and actions check permissions again; RLS is the last line.
 */
export const proxy = async (request: NextRequest) => {
  const { supabase, getResponse } = createSupabaseProxyClient(request);

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;

  // Staff or customer, and its status: one database call (spec 004).
  let account: SessionAccount | null = null;
  if (userId) {
    const { data: rows } = await supabase.rpc('current_account');
    account = toSessionAccount(rows?.[0]);
  }

  const now = Date.now();
  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    hasSession: Boolean(userId),
    account,
    authMethods: (data?.claims.amr ?? []).map((entry) =>
      typeof entry === 'string' ? entry : entry.method
    ),
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
    // Also left out (spec 006): the manifest, which browsers fetch without cookies (a visitor
    // would get a redirect to the login instead); the service worker and its "Sin conexión" page;
    // and /api/version, polled every few seconds while offline, which needs no session.
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|api/version|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
