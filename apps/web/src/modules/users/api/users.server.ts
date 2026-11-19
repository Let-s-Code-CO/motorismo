import 'server-only';

import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

/** Every user, read with the admin's own session: RLS decides what is visible (CA-17). */
export const listUsers = async () => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, status, avatar_url')
    .order('full_name');

  if (error) throw new Error(`Could not list users: ${error.message}`);
  return data;
};

export type UserRow = Awaited<ReturnType<typeof listUsers>>[number];
