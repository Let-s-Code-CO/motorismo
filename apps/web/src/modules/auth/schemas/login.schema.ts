import { z } from 'zod';

/** Errors are message keys under `auth.validation`. */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'emailInvalid' })),
  password: z.string().min(1, { error: 'passwordRequired' }),
});

export type LoginValues = z.output<typeof loginSchema>;
