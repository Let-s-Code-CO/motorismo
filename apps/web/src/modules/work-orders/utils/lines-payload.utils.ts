import type { WorkOrderValues } from '@web/modules/work-orders/schemas/work-order.schema';

/**
 * The lines as save_work_order and correct_work_order expect them (spec 008):
 * - an existing line is sent by its id (it keeps its service and, for a catalog line, its name);
 * - a new catalog line sends its service: the database copies its name (RN-01);
 * - «Otro» (no service) sends its description, new or existing.
 * Price, time and employees are always sent, so a blank time or no employees is saved as such.
 */
export const toLinesPayload = (lines: WorkOrderValues['lines']) =>
  lines.map(({ id, service_id, name, price, estimated_minutes, employees }) => ({
    ...(id ? { id } : service_id ? { service_id } : {}),
    ...(service_id ? {} : { name }),
    price,
    estimated_minutes,
    employees: employees.map(({ employee_id, share_pct }) => ({ employee_id, share_pct })),
  }));
