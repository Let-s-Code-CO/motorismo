import { createClient } from '@supabase/supabase-js';

import 'server-only';

import type { Database } from '@motorismo/supabase/types';

import { env } from '@web/modules/core/config/env.config';

/**
 * Secret-key client: bypasses RLS and can call the Auth admin API (invite, ban). Server-only.
 * Use it only for what the user's own session cannot do, after checking permissions in code.
 */
export const createSupabaseAdminClient = () =>
  createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
