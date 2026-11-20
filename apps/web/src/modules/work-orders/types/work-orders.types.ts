import type { Enums, Tables } from '@motorismo/supabase/types';

import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';

export type WorkOrderStatus = Enums<'work_order_status'>;
export type PaymentMethod = Enums<'payment_method'>;

/** A customer found in «Nueva orden» (active only, CA-10). */
export type PickerCustomer = Pick<Tables<'customers'>, 'id' | 'full_name' | 'phone' | 'email'>;

/** An active vehicle of the chosen customer, and its open order if it has one. */
export type PickerVehicle = {
  id: string;
  vehicle_type: VehicleType;
  plate: string | null;
  brand_name: string;
  line_name: string | null;
  openOrder: { id: string; number: number } | null;
};

/** An active service, with its reference price per vehicle type and its time (spec 007, 008). */
export type ServiceOption = Pick<
  Tables<'services'>,
  'id' | 'name' | 'price_motorcycle' | 'price_car' | 'price_bicycle' | 'estimated_minutes'
>;

/** An active employee. */
export type EmployeeOption = Pick<Tables<'employees'>, 'id' | 'full_name'>;

/** A row of the summary view: totals, estimate and who did what (spec 008). */
export type WorkOrderSummary = Tables<'work_order_summaries'>;

/** A line of an order with its employees, as the detail and the editor show it. */
export type WorkOrderLine = {
  id: string;
  position: number;
  service_id: string | null;
  name: string;
  price: number;
  estimated_minutes: number | null;
  employees: { employee_id: string; full_name: string; share_pct: number }[];
};

/** An order with everything the detail shows (CA-20). */
export type WorkOrderDetail = {
  summary: WorkOrderSummary;
  lines: WorkOrderLine[];
  payments: { method: PaymentMethod; amount: number }[];
};
