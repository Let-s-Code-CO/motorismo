import type { Enums, Tables } from '@motorismo/supabase/types';

export type UserRole = Enums<'user_role'>;
export type UserStatus = Enums<'user_status'>;

/** The signed-in user as the app sees it (from public.profiles). */
export type CurrentUser = Pick<
  Tables<'profiles'>,
  'id' | 'email' | 'full_name' | 'role' | 'status' | 'avatar_url'
>;
