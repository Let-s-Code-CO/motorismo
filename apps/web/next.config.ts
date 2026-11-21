import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import './src/modules/core/config/env.config';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * The version of this build (spec 006, HU-04): Vercel's deployment ID, or the commit, or the build
 * time locally. Inlined in the server and the browser bundles alike, so /api/version answers what
 * the live deployment was built with and an open app can tell it is out of date.
 */
const appVersion =
  process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? `local-${Date.now()}`;

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@motorismo/supabase'],
  // Dev logs Server Function arguments by default: that would print passwords and personal data.
  logging: { serverFunctions: false },
  // Metadata in the <head> from the first byte, for everyone (spec 011, CA-03): a screen still
  // loading behind its skeleton already has its title (WCAG 2.4.2). Our metadata is only the
  // translated app name, resolved at once, so blocking on it costs nothing.
  htmlLimitedBots: /.*/,
  async headers() {
    return [
      {
        // The browser always fetches the latest service worker (Next 16 PWA guide).
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
