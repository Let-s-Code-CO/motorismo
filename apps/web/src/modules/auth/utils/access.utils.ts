import type { UserStatus } from '@web/modules/auth/types/auth.types';

/** Spec 002 assumption: a session unused for more than 7 days is closed. */
export const SESSION_INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

const LOGIN_PATH = '/auth/login';
const SET_PASSWORD_PATH = '/auth/set-password';
/** Pages for visitors only: someone already signed in goes home. */
const ENTRY_PATHS = [LOGIN_PATH, '/auth/forgot-password'];
/** Routes that handle email/OAuth links: reachable by anyone, they manage the session themselves. */
const LINK_PATHS = ['/auth/confirm', '/auth/callback', '/auth/invalid-link'];

export type AccessInput = {
  pathname: string;
  search?: string;
  hasSession: boolean;
  profile: { status: UserStatus } | null;
  lastSeenAt: number | null;
  now: number;
};

export type AccessDecision =
  { type: 'allow'; touchActivity: boolean } | { type: 'redirect'; to: string; signOut: boolean };

const allow = (touchActivity: boolean): AccessDecision => ({ type: 'allow', touchActivity });
const redirect = (to: string, signOut = false): AccessDecision => ({
  type: 'redirect',
  to,
  signOut,
});

export const isSessionExpired = (lastSeenAt: number | null, now: number) =>
  lastSeenAt === null || now - lastSeenAt > SESSION_INACTIVITY_LIMIT_MS;

/** What the proxy does with a request. Pure, so every branch is unit-tested. */
export const decideAccess = ({
  pathname,
  search = '',
  hasSession,
  profile,
  lastSeenAt,
  now,
}: AccessInput): AccessDecision => {
  if (LINK_PATHS.includes(pathname)) return allow(false);

  if (!hasSession) {
    if (ENTRY_PATHS.includes(pathname)) return allow(false);
    if (pathname === '/' || pathname === SET_PASSWORD_PATH) return redirect(LOGIN_PATH);
    return redirect(`${LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}`);
  }

  // Disabled before inactivity, so the user learns why they were removed (CA-06, CA-19).
  if (!profile || profile.status === 'disabled') {
    return redirect(`${LOGIN_PATH}?error=account_disabled`, true);
  }
  if (isSessionExpired(lastSeenAt, now))
    return redirect(`${LOGIN_PATH}?error=session_expired`, true);

  if (profile.status === 'invited') {
    return pathname === SET_PASSWORD_PATH ? allow(true) : redirect(SET_PASSWORD_PATH);
  }

  if (ENTRY_PATHS.includes(pathname)) return redirect('/');
  return allow(true);
};

const INTERNAL_ORIGIN = 'http://internal.invalid';

/** Returns `raw` only if it is an internal, non-auth path; blocks open redirects. */
export const sanitizeNextPath = (raw?: string | null): string | null => {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return null;

  const url = new URL(raw, INTERNAL_ORIGIN);
  if (url.origin !== INTERNAL_ORIGIN || url.pathname.startsWith('/auth/')) return null;

  return url.pathname + url.search;
};
