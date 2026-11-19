import type { UserStatus } from '@web/modules/auth/types/auth.types';

/** Spec 002 assumption: a session unused for more than 7 days is closed. */
export const SESSION_INACTIVITY_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;

const LOGIN_PATH = '/auth/login';
const SET_PASSWORD_PATH = '/auth/set-password';
const CUSTOMER_HOME = '/profile';
/** Pages for visitors only: someone already signed in goes to their home page. */
const ENTRY_PATHS = [LOGIN_PATH, '/auth/forgot-password', '/auth/sign-up'];
/** Routes that handle email/OAuth links: reachable by anyone, they manage the session themselves. */
const LINK_PATHS = ['/auth/confirm', '/auth/callback', '/auth/invalid-link'];
/** Open to everyone, with or without a session (spec 004, RF-03). */
const PUBLIC_PATHS = ['/privacy'];
/** Session method of every email link (invitation, recovery, confirmation): Auth's "amr". */
const EMAIL_LINK_METHOD = 'otp';

/** What the proxy knows about the signed-in account (public.current_account(), spec 004). */
export type SessionAccount =
  { kind: 'staff'; status: UserStatus } | { kind: 'customer'; status: 'active' | 'disabled' };

export type AccessInput = {
  pathname: string;
  search?: string;
  hasSession: boolean;
  account: SessionAccount | null;
  /** Authentication methods of the session (JWT "amr"), e.g. ["password"] or ["otp"]. */
  authMethods?: string[];
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

/** A row of public.current_account() → what decideAccess needs; anything unexpected is null. */
export const toSessionAccount = (
  row: { kind: string; status: string } | null | undefined
): SessionAccount | null => {
  if (row?.kind === 'customer' && (row.status === 'active' || row.status === 'disabled')) {
    return { kind: 'customer', status: row.status };
  }
  if (row?.kind === 'staff' && ['invited', 'active', 'disabled'].includes(row.status)) {
    return { kind: 'staff', status: row.status as UserStatus };
  }
  return null;
};

/** What the proxy does with a request. Pure, so every branch is unit-tested. */
export const decideAccess = ({
  pathname,
  search = '',
  hasSession,
  account,
  authMethods = [],
  lastSeenAt,
  now,
}: AccessInput): AccessDecision => {
  if (LINK_PATHS.includes(pathname) || PUBLIC_PATHS.includes(pathname)) return allow(false);

  if (!hasSession) {
    if (ENTRY_PATHS.includes(pathname)) return allow(false);
    if (pathname === '/' || pathname === SET_PASSWORD_PATH) return redirect(LOGIN_PATH);
    return redirect(`${LOGIN_PATH}?next=${encodeURIComponent(pathname + search)}`);
  }

  // Disabled before inactivity, so the user learns why they were removed (CA-06, CA-19, CA-29).
  if (!account || account.status === 'disabled') {
    return redirect(`${LOGIN_PATH}?error=account_disabled`, true);
  }
  if (isSessionExpired(lastSeenAt, now))
    return redirect(`${LOGIN_PATH}?error=session_expired`, true);

  if (account.kind === 'customer') {
    // Staff pages are let through: the page answers "no permission" (spec 004, CA-09).
    if (pathname === '/' || ENTRY_PATHS.includes(pathname)) return redirect(CUSTOMER_HOME);
    return allow(true);
  }

  if (account.status === 'invited') {
    // Only the invitation (or recovery) link proves the invitation is theirs (spec 004, plan risk 2).
    if (!authMethods.includes(EMAIL_LINK_METHOD)) return redirect(LOGIN_PATH, true);
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
