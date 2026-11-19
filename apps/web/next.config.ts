import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

import './src/modules/core/config/env.config';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@motorismo/supabase'],
  // Dev logs Server Function arguments by default: that would print passwords and personal data.
  logging: { serverFunctions: false },
};

export default withNextIntl(nextConfig);
