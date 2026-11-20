import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

/**
 * Typed, validated environment. Importing this module fails fast (at build and at boot) when a
 * required variable is missing or malformed, instead of failing later inside a Supabase call.
 * Server variables are never exposed to the browser. Set SKIP_ENV_VALIDATION=1 only for tooling
 * that never talks to Supabase (unit tests, lint).
 */
export const env = createEnv({
  server: {
    // Secret key: Auth admin API (invitations, bans). Server-only by construction.
    SUPABASE_SECRET_KEY: z.string().min(1),
    // Set by Vercel on every deployment (host without protocol).
    VERCEL_URL: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    // Public base URL used in email and OAuth redirect links; optional (see site-url.utils).
    NEXT_PUBLIC_SITE_URL: z.url().optional(),
    // Set by next.config.ts at build time, never by hand: the deployment's version (spec 006).
    NEXT_PUBLIC_APP_VERSION: z.string().min(1).default('dev'),
  },
  runtimeEnv: {
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    VERCEL_URL: process.env.VERCEL_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
