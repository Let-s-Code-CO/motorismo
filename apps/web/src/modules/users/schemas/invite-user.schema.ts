import { z } from 'zod';

import { Constants } from '@motorismo/supabase/types';

/** CA-13. Same name limit as the database check. Errors are message keys under `users.validation`. */
export const inviteUserSchema = z.object({
  full_name: z
    .string({ error: 'fullNameRequired' })
    .trim()
    .min(1, { error: 'fullNameRequired' })
    .max(120, { error: 'fullNameTooLong' }),
  email: z
    .string({ error: 'emailInvalid' })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'emailInvalid' })),
  role: z.enum(Constants.public.Enums.user_role, { error: 'roleRequired' }),
});

export type InviteUserInput = z.input<typeof inviteUserSchema>;
export type InviteUserValues = z.output<typeof inviteUserSchema>;
