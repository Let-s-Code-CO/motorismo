import { Constants } from '@motorismo/supabase/types';

import type { UserStatus } from '@web/modules/auth/types/auth.types';

/** `?status=` value → a known status, or null (no filter) for anything else (spec 003, CA-09). */
export const parseStatusFilter = (raw?: string | null): UserStatus | null =>
  Constants.public.Enums.user_status.find((status) => status === raw) ?? null;

export const filterUsersByStatus = <T extends { status: UserStatus }>(
  users: T[],
  status: UserStatus | null
): T[] => (status ? users.filter((user) => user.status === status) : users);
