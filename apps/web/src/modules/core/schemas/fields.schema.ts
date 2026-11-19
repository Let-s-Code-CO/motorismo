import { z } from 'zod';

import { normalizeMobile } from '@web/modules/core/utils/phone.utils';

/**
 * Form fields shared by sign-up, "Mi perfil" and the customer record (spec 004). Errors are
 * message KEYS; each module translates them under its own `validation` namespace.
 */

/** Same limit as the database checks (1–120 characters). */
export const fullNameField = z
  .string({ error: 'fullNameRequired' })
  .trim()
  .min(1, { error: 'fullNameRequired' })
  .max(120, { error: 'fullNameTooLong' });

export const emailField = z
  .string({ error: 'emailInvalid' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'emailInvalid' }));

/** Optional Colombian mobile (RN-03): blank → null, otherwise the 10 digits or an error. */
export const optionalMobileField = z
  .string()
  // null: the value already normalised by the form (Server Actions receive the parsed output).
  .nullish()
  .transform((raw, ctx) => {
    const value = raw?.trim() ?? '';
    if (!value) return null;
    const mobile = normalizeMobile(value);
    if (!mobile) {
      ctx.addIssue({ code: 'custom', message: 'phoneInvalid' });
      // The raw value is kept so cross-field checks still see that a phone was given.
      return value;
    }
    return mobile;
  });

/** Optional email (counter customers): blank → null, otherwise a valid lowercase email. */
export const optionalEmailField = z
  .string()
  // null: the value already normalised by the form (Server Actions receive the parsed output).
  .nullish()
  .transform((raw, ctx) => {
    const value = raw?.trim().toLowerCase() ?? '';
    if (!value) return null;
    if (!z.email().safeParse(value).success) {
      ctx.addIssue({ code: 'custom', message: 'emailInvalid' });
      // The raw value is kept so cross-field checks still see that an email was given.
      return value;
    }
    return value;
  });
