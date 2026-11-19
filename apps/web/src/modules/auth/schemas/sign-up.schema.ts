import { z } from 'zod';

import { PASSWORD_MIN_LENGTH } from '@web/modules/auth/schemas/set-password.schema';
import {
  emailField,
  fullNameField,
  optionalMobileField,
} from '@web/modules/core/schemas/fields.schema';

/**
 * Customer sign-up (spec 004, HU-01, CA-06). The consent is mandatory (RN-04): the database
 * rejects an email sign-up without it too. Errors are message keys under `auth.validation`.
 */
export const signUpSchema = z.object({
  full_name: fullNameField,
  email: emailField,
  phone: optionalMobileField.transform((phone) => phone ?? undefined),
  password: z.string().min(PASSWORD_MIN_LENGTH, { error: 'passwordTooShort' }),
  data_consent: z.literal(true, { error: 'consentRequired' }),
});

export type SignUpInput = z.input<typeof signUpSchema>;
export type SignUpValues = z.output<typeof signUpSchema>;
