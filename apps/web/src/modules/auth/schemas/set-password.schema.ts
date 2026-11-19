import { z } from 'zod';

/** RN-04: at least 8 characters. Errors are message keys under `auth.validation`. */
export const PASSWORD_MIN_LENGTH = 8;

export const setPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, { error: 'passwordTooShort' }),
    confirm: z.string(),
  })
  .refine(({ password, confirm }) => password === confirm, {
    error: 'passwordsDoNotMatch',
    path: ['confirm'],
  });

export type SetPasswordValues = z.output<typeof setPasswordSchema>;
