/** Message keys under `vehicles.catalog.errors`. */
export type VehicleCatalogErrorKey =
  | 'forbidden'
  | 'invalidInput'
  | 'nameTaken'
  | 'nameRequired'
  | 'nameTooLong'
  | 'typeMismatch'
  | 'brandMismatch'
  | 'sameItem'
  | 'notFound'
  | 'generic';

const BY_HINT: Record<string, VehicleCatalogErrorKey> = {
  catalog_admin_only: 'forbidden',
  catalog_name_taken: 'nameTaken',
  catalog_name_required: 'nameRequired',
  catalog_name_too_long: 'nameTooLong',
  catalog_type_mismatch: 'typeMismatch',
  catalog_brand_mismatch: 'brandMismatch',
  catalog_same_item: 'sameItem',
  catalog_not_found: 'notFound',
};

/** Refusals of the catalog functions (spec 018) → message keys. */
export const fromVehicleCatalogError = (error: {
  code?: string;
  hint?: string | null;
}): VehicleCatalogErrorKey =>
  (error.hint && BY_HINT[error.hint]) || (error.code === '42501' ? 'forbidden' : 'generic');
