/** Message keys under `services.errors`. */
export type ServicesErrorKey =
  'forbidden' | 'invalidInput' | 'nameTaken' | 'nameTakenDisabled' | 'notFound' | 'generic';

/** Database refusals (hints set by public.services_guard, spec 007) → message keys. */
export const fromServicesGuardError = (error: {
  code?: string;
  hint?: string | null;
}): ServicesErrorKey => {
  if (error.hint === 'service_name_taken') return 'nameTaken';
  if (error.hint === 'service_name_taken_disabled') return 'nameTakenDisabled';
  if (error.code === '42501') return 'forbidden';
  return 'generic';
};
