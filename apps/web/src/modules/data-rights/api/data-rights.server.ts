import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import type {
  CustomerData,
  DataRequestSummary,
  MyDataRequest,
} from '@web/modules/data-rights/types/data-rights.types';

/**
 * Data requests and a customer's data (spec 017), read with the session's own rights: the
 * functions and RLS give a customer only theirs and the admin everything (RN-01).
 */

/** CA-01: everything the business keeps of the signed-in customer. */
export const getMyData = async (): Promise<CustomerData> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('my_data');
  if (error) throw new Error(`Could not read the customer's data: ${error.message}`);
  // jsonb built by private.customer_data_json, whose shape the type describes.
  return data as unknown as CustomerData;
};

/** CA-17: everything the business keeps of a customer, for the admin. */
export const getCustomerData = async (customerId: string): Promise<CustomerData> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('customer_data', { p_customer: customerId });
  if (error) throw new Error(`Could not read the customer's data: ${error.message}`);
  return data as unknown as CustomerData;
};

/** CA-07: the signed-in customer's requests, newest first (RLS: only theirs). */
export const listMyRequests = async (): Promise<MyDataRequest[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('data_requests')
    .select('id, kind, channel, status, received_at, due_on, resolved_at, response')
    .order('received_at', { ascending: false });
  if (error) throw new Error(`Could not list the requests: ${error.message}`);
  return data;
};

/** CA-09: every request, the ones due first. */
export const listDataRequests = async (): Promise<DataRequestSummary[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('data_request_summaries')
    .select('*')
    .order('due_on')
    .order('received_at');
  if (error) throw new Error(`Could not list the requests: ${error.message}`);
  return data as DataRequestSummary[];
};

export const getDataRequest = async (id: string): Promise<DataRequestSummary | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('data_request_summaries')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Could not read the request: ${error.message}`);
  return data as DataRequestSummary | null;
};

/** CA-13: the open order that stops an erasure, if any. */
export const openOrderOf = async (customerId: string): Promise<number | null> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('work_orders')
    .select('number')
    .eq('customer_id', customerId)
    .eq('status', 'open')
    .order('number')
    .limit(1)
    .maybeSingle();
  return data?.number ?? null;
};

/** CA-10: how many are pending and how many of them overdue, for the admin's home. */
export const dataRequestsSummary = async (): Promise<{ pending: number; overdue: number }> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('data_request_summaries')
    .select('overdue')
    .eq('status', 'received');
  if (error) throw new Error(`Could not count the requests: ${error.message}`);
  return { pending: data.length, overdue: data.filter((row) => row.overdue).length };
};
