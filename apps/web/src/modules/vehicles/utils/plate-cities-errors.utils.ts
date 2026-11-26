/** Message keys under `vehicles.plateCities.errors`. */
export type PlateCitiesErrorKey = 'forbidden' | 'invalidInput' | 'notIssuing' | 'generic';

const BY_HINT: Record<string, PlateCitiesErrorKey> = {
  plate_admin_only: 'forbidden',
  plate_city_not_issuing: 'notIssuing',
  plate_legend_invalid: 'invalidInput',
};

/** Refusals of set_plate_legend (spec 023) → message keys. */
export const fromPlateCitiesError = (error: {
  code?: string;
  hint?: string | null;
}): PlateCitiesErrorKey =>
  (error.hint && BY_HINT[error.hint]) || (error.code === '42501' ? 'forbidden' : 'generic');
