import { z } from 'zod';

/** Errors are message keys under `auth.validation`. */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'emailInvalid' })),
});

export type ForgotPasswordValues = z.output<typeof forgotPasswordSchema>;
