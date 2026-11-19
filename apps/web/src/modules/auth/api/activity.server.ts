import { cookies } from 'next/headers';

import 'server-only';

import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
} from '@web/modules/auth/utils/activity-cookie.utils';

/** Starts or refreshes the 7-day inactivity clock (Server Actions). */
export const touchActivityCookie = async () => {
  (await cookies()).set(ACTIVITY_COOKIE, String(Date.now()), activityCookieOptions);
};

export const clearActivityCookie = async () => {
  (await cookies()).delete(ACTIVITY_COOKIE);
};
