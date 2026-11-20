/** Message keys under `customers.errors`. */
export type CustomersErrorKey =
  'forbidden' | 'invalidInput' | 'emailTaken' | 'emailLocked' | 'notFound' | 'generic';

/** Database refusals (hints set by public.customers_guard, spec 004) → message keys. */
export const fromCustomerGuardError = (error: { hint?: string | null }): CustomersErrorKey => {
  if (error.hint === 'customer_email_taken') return 'emailTaken';
  if (error.hint === 'customer_email_locked') return 'emailLocked';
  if (error.hint === 'customer_staff_only') return 'forbidden';
  return 'generic';
};
