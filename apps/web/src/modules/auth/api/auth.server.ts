import { cache } from 'react';

import { redirect } from 'next/navigation';

import 'server-only';

import type {
  CurrentAccount,
  CurrentCustomer,
  CurrentUser,
} from '@web/modules/auth/types/auth.types';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

/**
 * The signed-in account, read from the database on every request (role and status are NOT taken
 * from the JWT: changes must apply on the next action, spec 002 CA-18 / CA-19). Staff come from
 * public.profiles, customers from public.customers (spec 004). Cached per request.
 */
export const getCurrentAccount = cache(async (): Promise<CurrentAccount | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, status, avatar_url')
    .eq('id', userId)
    .maybeSingle();
  if (profile) return { kind: 'staff', ...profile };

  const { data: customer } = await supabase
    .from('customers')
    .select('id, user_id, email, full_name, phone, avatar_url, disabled_at, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (customer) return { kind: 'customer', ...customer };

  return null;
});

const isUsable = (account: CurrentAccount | null): account is CurrentAccount =>
  account !== null &&
  (account.kind === 'staff' ? account.status === 'active' : account.disabled_at === null);

/** For the signed-in area: an ACTIVE staff member or an enabled customer, or the login. */
export const requireAccount = async (): Promise<CurrentAccount> => {
  const account = await getCurrentAccount();
  if (!isUsable(account)) redirect('/auth/login');
  return account;
};

/**
 * For staff pages: the active staff member, or null for a customer — the page then answers
 * "no permission" (spec 004, CA-09). Visitors and unusable accounts go to the login.
 */
export const getStaffForPage = async (): Promise<CurrentUser | null> => {
  const account = await requireAccount();
  return account.kind === 'staff' ? account : null;
};

/** For customer pages ("Mi perfil"): the customer; staff go to their home page. */
export const requireCustomer = async (): Promise<CurrentCustomer> => {
  const account = await requireAccount();
  if (account.kind !== 'customer') redirect('/');
  return account;
};

/** For Server Actions: the active staff member (operator or admin), or null. */
export const getActiveStaff = async (): Promise<CurrentUser | null> => {
  const account = await getCurrentAccount();
  return account?.kind === 'staff' && account.status === 'active' ? account : null;
};

/** For Server Actions: the active admin, or null (callers return a "forbidden" result). */
export const getActiveAdmin = async (): Promise<CurrentUser | null> => {
  const staff = await getActiveStaff();
  return staff?.role === 'admin' ? staff : null;
};

/** For Server Actions: the enabled customer of this session, or null. */
export const getActiveCustomer = async (): Promise<CurrentCustomer | null> => {
  const account = await getCurrentAccount();
  return account?.kind === 'customer' && account.disabled_at === null ? account : null;
};
