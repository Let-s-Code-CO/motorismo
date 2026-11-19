import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@motorismo/supabase/types';

import { env } from '@web/modules/core/config/env.config';

/** Supabase client for Client Components. Typed against the generated `Database` schema. */
export const createSupabaseBrowserClient = () =>
  createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
