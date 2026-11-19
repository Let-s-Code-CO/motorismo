import { z } from 'zod';

import { fullNameField, optionalMobileField } from '@web/modules/core/schemas/fields.schema';

/**
 * "Mi perfil" (spec 004, HU-03): a customer changes only their name and phone; the email is not
 * part of it (RN-10). Errors are message keys under `customers.validation`.
 */
export const myProfileSchema = z.object({
  full_name: fullNameField,
  phone: optionalMobileField,
});

export type MyProfileInput = z.input<typeof myProfileSchema>;
export type MyProfileValues = z.output<typeof myProfileSchema>;
