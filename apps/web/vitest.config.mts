import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { type Plugin, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()] as Plugin[],
  resolve: {
    alias: {
      'server-only': new URL('./__mocks__/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    // Unit tests never talk to Supabase; env.config.test.ts re-enables validation per case.
    env: { SKIP_ENV_VALIDATION: '1' },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['__test__/**/*.{test,spec}.{ts,tsx}'],
    // Sandbox suites need a running local Supabase: `pnpm test:sandbox`.
    exclude: ['__test__/sandbox/**', 'node_modules/**'],
    server: {
      deps: {
        inline: ['next-intl'],
      },
    },
    coverage: {
      provider: 'istanbul',
      reportsDirectory: './coverage',
      reporter: ['text', 'html', 'json-summary'],
      // Every source file counts (untested ones at 0%), so the number only moves when tests move.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', 'src/app/**/layout.tsx', 'src/app/hero.ts'],
    },
  },
});
