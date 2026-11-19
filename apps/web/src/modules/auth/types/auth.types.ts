import type { Enums, Tables } from '@motorismo/supabase/types';

export type UserRole = Enums<'user_role'>;
export type UserStatus = Enums<'user_status'>;
export type CustomerStatus = Enums<'customer_status'>;

/** A staff member as the app sees them (from public.profiles, spec 002). */
export type CurrentUser = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'full_name' | 'role' | 'status' | 'avatar_url'
>;

/** A customer with an account (from public.customers, spec 004). */
export type CurrentCustomer = Pick<
  Tables<'customers'>,
  'id' | 'user_id' | 'email' | 'full_name' | 'phone' | 'avatar_url' | 'disabled_at' | 'created_at'
>;

/** Whoever is signed in: staff or customer, never both (spec 004). */
export type CurrentAccount =
  ({ kind: 'staff' } & CurrentUser) | ({ kind: 'customer' } & CurrentCustomer);

/** Who a menu or a chip is for: each staff role, or a customer. */
export type Audience = UserRole | 'customer';

export const audienceOf = (account: CurrentAccount): Audience =>
  account.kind === 'staff' ? account.role : 'customer';
