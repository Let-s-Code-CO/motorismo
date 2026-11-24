import type { Database, Tables } from '@motorismo/supabase/types';

type Enums = Database['public']['Enums'];

export type DataRequestKind = Enums['data_request_kind'];
export type DataRequestChannel = Enums['data_request_channel'];
export type DataRequestStatus = Enums['data_request_status'];

/** A request as its customer reads it (RLS: only theirs). */
export type MyDataRequest = Pick<
  Tables<'data_requests'>,
  'id' | 'kind' | 'channel' | 'status' | 'received_at' | 'due_on' | 'resolved_at' | 'response'
>;

/**
 * A request in the admin's list (spec 017, CA-09), from `data_request_summaries`. The generator
 * marks every column of a view nullable; these are never null on a row of the view.
 */
type SummaryRow = Tables<'data_request_summaries'>;
export type DataRequestSummary = Omit<
  SummaryRow,
  | 'id'
  | 'customer_id'
  | 'customer_name'
  | 'customer_has_account'
  | 'customer_erased'
  | 'kind'
  | 'channel'
  | 'status'
  | 'received_at'
  | 'due_on'
  | 'overdue'
> & {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_has_account: boolean;
  customer_erased: boolean;
  kind: DataRequestKind;
  channel: DataRequestChannel;
  status: DataRequestStatus;
  received_at: string;
  due_on: string;
  overdue: boolean;
};

type VehicleRef = { brand: string; line: string | null; plate: string | null };

/** Everything the business keeps of a customer (CA-01), as `my_data` / `customer_data` build it. */
export type CustomerData = {
  profile: {
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    origin: Enums['customer_origin'];
    registered_at: string;
    consent_at: string;
  };
  vehicles: (VehicleRef & {
    vehicle_type: Enums['vehicle_type'];
    color: string;
    retired_at: string | null;
  })[];
  orders: {
    number: number;
    status: Enums['work_order_status'];
    opened_at: string;
    closed_at: string | null;
    voided_at: string | null;
    vehicle: VehicleRef;
    services: { name: string; price: number }[];
    discount: number;
    total: number;
    payments: { method: Enums['payment_method']; amount: number }[];
  }[];
  reservations: {
    number: number;
    status: Enums['reservation_status'];
    slot_start: string;
    slot_end: string;
    vehicle: VehicleRef | null;
    services: string[];
    notes: string | null;
    cancel_reason: string | null;
  }[];
  requests: {
    kind: DataRequestKind;
    channel: DataRequestChannel;
    status: DataRequestStatus;
    description: string | null;
    received_at: string;
    due_on: string;
    resolved_at: string | null;
    response: string | null;
  }[];
};
