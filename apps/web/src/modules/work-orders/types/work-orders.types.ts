import type { Enums, Tables } from '@motorismo/supabase/types';

import type { MotorcycleCategory } from '@web/modules/vehicles/constants/motorcycle-categories.constants';
import type { VehicleType } from '@web/modules/vehicles/types/vehicles.types';
import type { MatchedPlate } from '@web/modules/work-orders/utils/plate-search.utils';

export type WorkOrderStatus = Enums<'work_order_status'>;
export type PaymentMethod = Enums<'payment_method'>;

/** A customer found in «Nueva orden» (active only, CA-10). */
export type PickerCustomer = Pick<Tables<'customers'>, 'id' | 'full_name' | 'phone' | 'email'> & {
  /** The active plate the search matched, with its city, if it matched by plate (spec 022, CA-11). */
  matchedPlate?: MatchedPlate | null;
};

/** An active vehicle of the chosen customer, and its open order if it has one. */
export type PickerVehicle = {
  id: string;
  vehicle_type: VehicleType;
  plate: string | null;
  brand_name: string;
  line_name: string | null;
  /** A motorcycle's category, its own or its line's (spec 024, CA-04); null otherwise. */
  category: MotorcycleCategory | null;
  openOrder: { id: string; number: number } | null;
};

/** An active service, with its reference price per vehicle type and its time (spec 007, 008). */
export type ServiceOption = Pick<
  Tables<'services'>,
  | 'id'
  | 'name'
  | 'price_motorcycle'
  | 'price_car'
  | 'price_bicycle'
  | 'estimated_minutes'
  | 'on_quote'
> & {
  /** The motorcycle value per category (spec 024, CA-07), or null. */
  motorcycle_prices: Record<MotorcycleCategory, number> | null;
};

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
