/** Message keys under `orders.errors`. */
export type WorkOrdersErrorKey =
  | 'forbidden'
  | 'invalidInput'
  | 'customerDisabled'
  | 'vehicleRetired'
  | 'vehicleInvalid'
  | 'vehicleBusy'
  | 'serviceUnavailable'
  | 'employeeUnavailable'
  | 'sharesInvalid'
  | 'discountInvalid'
  | 'linesRequired'
  | 'otherNameRequired'
  | 'notOpen'
  | 'notClosed'
  | 'lineWithoutEmployees'
  | 'paymentsMismatch'
  | 'reasonRequired'
  | 'alreadyVoided'
  | 'adminOnly'
  | 'notFound'
  | 'generic';

const BY_HINT: Record<string, WorkOrdersErrorKey> = {
  work_order_staff_only: 'forbidden',
  work_order_customer_disabled: 'customerDisabled',
  work_order_customer_not_found: 'notFound',
  work_order_vehicle_retired: 'vehicleRetired',
  work_order_vehicle_invalid: 'vehicleInvalid',
  work_order_vehicle_busy: 'vehicleBusy',
  work_order_service_unavailable: 'serviceUnavailable',
  work_order_employee_unavailable: 'employeeUnavailable',
  work_order_shares_invalid: 'sharesInvalid',
  work_order_discount_invalid: 'discountInvalid',
  work_order_lines_required: 'linesRequired',
  work_order_other_name_required: 'otherNameRequired',
  work_order_not_open: 'notOpen',
  work_order_not_closed: 'notClosed',
  work_order_line_without_employees: 'lineWithoutEmployees',
  work_order_payments_mismatch: 'paymentsMismatch',
  work_order_reason_required: 'reasonRequired',
  work_order_already_voided: 'alreadyVoided',
  work_order_admin_only: 'adminOnly',
  work_order_not_found: 'notFound',
  work_order_line_not_found: 'notFound',
};

/** Database refusals (hints set by the work order functions, spec 008) → message keys. */
export const fromWorkOrderError = (error: { hint?: string | null }): WorkOrdersErrorKey =>
  (error.hint && BY_HINT[error.hint]) || 'generic';
