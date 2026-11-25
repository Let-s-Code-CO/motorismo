import type { ActionResult } from '@web/modules/core/types/action-result.types';
import type { CustomersErrorKey } from '@web/modules/customers/utils/customers-errors.utils';
import type { VehiclesErrorKey } from '@web/modules/vehicles/utils/vehicles-errors.utils';

/**
 * What registering a customer answers: the new customer's id, a refusal of the customer (spec 004),
 * or a refusal of their first vehicle with the vehicle's own error (spec 022, CA-07).
 */
export type CreateCustomerResult =
  | { ok: true; id: string }
  | Exclude<ActionResult<CustomersErrorKey>, { ok: true }>
  | { ok: false; error: 'vehicle'; vehicleError: VehiclesErrorKey };
