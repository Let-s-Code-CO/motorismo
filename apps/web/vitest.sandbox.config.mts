import tsconfigPaths from 'vite-tsconfig-paths';
import { type Plugin, defineConfig } from 'vitest/config';

/**
 * Sandbox suites: talk to the REAL local Supabase (`pnpm db:start`) and read emails from Mailpit.
 * They verify what mocks cannot: Auth behaviour, RLS seen from the API, the invitation emails.
 * Files run one after another because they share the sandbox.
 */
export default defineConfig({
  plugins: [tsconfigPaths()] as Plugin[],
  test: {
    environment: 'node',
    globals: true,
    include: ['__test__/sandbox/**/*.sandbox.test.ts'],
    globalSetup: ['__test__/sandbox/support/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
