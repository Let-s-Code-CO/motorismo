import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

import 'server-only';

import type { Database } from '@motorismo/supabase/types';

import { env } from '@web/modules/core/config/env.config';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers. It reads and writes the
 * auth session from the request cookies. Create one per request; never share it between requests.
 */
export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot write cookies; the session is refreshed elsewhere.
          }
        },
      },
    }
  );
};
