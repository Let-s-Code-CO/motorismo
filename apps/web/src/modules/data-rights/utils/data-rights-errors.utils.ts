/** Message keys under `dataRights.errors`. */
export type DataRightsErrorKey =
  | 'forbidden'
  | 'invalidInput'
  | 'alreadyOpen'
  | 'descriptionRequired'
  | 'responseRequired'
  | 'closed'
  | 'notFound'
  | 'openOrder'
  | 'googleEmail'
  | 'emailTaken'
  | 'generic';

const BY_HINT: Record<string, DataRightsErrorKey> = {
  data_request_open: 'alreadyOpen',
  data_request_description_required: 'descriptionRequired',
  data_request_response_required: 'responseRequired',
  data_request_closed: 'closed',
  data_request_not_found: 'notFound',
  data_request_customer_not_found: 'notFound',
  data_erasure_open_order: 'openOrder',
  data_request_admin_only: 'forbidden',
  data_request_customer_only: 'forbidden',
  data_request_channel_invalid: 'invalidInput',
  data_request_kind_invalid: 'invalidInput',
  data_request_wrong_kind: 'invalidInput',
};

/** Refusals of the data request functions (spec 017) → message keys. */
export const fromDataRightsError = (error: {
  code?: string;
  hint?: string | null;
}): DataRightsErrorKey =>
  (error.hint && BY_HINT[error.hint]) || (error.code === '42501' ? 'forbidden' : 'generic');
