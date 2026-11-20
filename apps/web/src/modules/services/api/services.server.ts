import 'server-only';

import type { Tables } from '@motorismo/supabase/types';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

const COLUMNS =
  'id, name, price_motorcycle, price_car, price_bicycle, estimated_minutes, disabled_at';

export type ServiceRow = Pick<
  Tables<'services'>,
  | 'id'
  | 'name'
  | 'price_motorcycle'
  | 'price_car'
  | 'price_bicycle'
  | 'estimated_minutes'
  | 'disabled_at'
>;

/**
 * The services catalog by name (spec 007, RF-04), read with the user's own session: an admin gets
 * the active and the disabled ones, an operator only the active ones (RLS, CA-15).
 */
export const listServices = async (): Promise<ServiceRow[]> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('services').select(COLUMNS).order('name');
  if (error) throw new Error(`Could not list services: ${error.message}`);
  return data;
};
