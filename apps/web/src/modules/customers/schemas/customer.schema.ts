import { z } from 'zod';

import {
  fullNameField,
  optionalEmailField,
  optionalMobileField,
} from '@web/modules/core/schemas/fields.schema';

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

const isFilled = (value: unknown) => typeof value === 'string' && value.trim() !== '';

/**
 * RN-02: a counter customer needs an email or a phone. Checked even when other fields fail (so the
 * form shows every problem at once); an invalid value counts as given (its own error is shown).
 */
const contactRequired = {
  path: ['email'],
  error: 'contactRequired',
  when: () => true,
};
const hasContact = (data: { email?: unknown; phone?: unknown }) =>
  isFilled(data.email) || isFilled(data.phone);

const contactFields = {
  full_name: fullNameField,
  email: optionalEmailField,
  phone: optionalMobileField,
};

/** Staff edit a customer (spec 004, CA-27). Errors are message keys under `customers.validation`. */
export const editCustomerSchema = z.object(contactFields).refine(hasContact, contactRequired);

/** Staff register a customer at the counter (spec 004, CA-24/CA-25): consent mandatory (RN-04). */
export const newCustomerSchema = z
  .object({
    ...contactFields,
    data_consent: z.literal(true, { error: 'consentRequired' }),
  })
  .refine(hasContact, contactRequired);

export type EditCustomerInput = z.input<typeof editCustomerSchema>;
export type EditCustomerValues = z.output<typeof editCustomerSchema>;
export type NewCustomerInput = z.input<typeof newCustomerSchema>;
export type NewCustomerValues = z.output<typeof newCustomerSchema>;
