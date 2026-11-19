import { z } from 'zod';

import { Constants } from '@motorismo/supabase/types';

/** CA-18: an admin assigns one of the two roles to another user. */
export const changeRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(Constants.public.Enums.user_role),
});

/** CA-19 / CA-20: disable or reactivate. Never back to "invited". */
export const setUserStatusSchema = z.object({
  userId: z.uuid(),
  status: z.enum(['active', 'disabled']),
});
