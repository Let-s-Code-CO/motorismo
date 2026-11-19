import { cache } from 'react';

import { redirect } from 'next/navigation';

import 'server-only';

import type { CurrentUser } from '@web/modules/auth/types/auth.types';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

/**
 * The signed-in user's profile, read from the database on every request (role and status are
 * NOT taken from the JWT: changes must apply on the next action, CA-18 / CA-19). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status')
    .eq('id', userId)
    .maybeSingle();

  return profile;
});

/** For pages: an ACTIVE user or a redirect to the login (the proxy normally got there first). */
export const requireUser = async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user || user.status !== 'active') redirect('/auth/login');
  return user;
};

/** For Server Actions: the active admin, or null (callers return a "forbidden" result). */
export const getActiveAdmin = async (): Promise<CurrentUser | null> => {
  const user = await getCurrentUser();
  return user?.status === 'active' && user.role === 'admin' ? user : null;
};
