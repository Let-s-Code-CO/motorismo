import { SESSION_INACTIVITY_LIMIT_MS } from '@web/modules/auth/utils/access.utils';

/** Last-activity timestamp (ms). Missing or older than 7 days ⇒ the session is closed. */
export const ACTIVITY_COOKIE = 'mt_last_seen';

export const activityCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_INACTIVITY_LIMIT_MS / 1000,
} as const;

export const parseLastSeen = (value?: string): number | null => {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
};
