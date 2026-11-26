import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E against the real app and the LOCAL Supabase with its seeds (`pnpm db:start` / `db:reset`).
 * Emails are read from Mailpit. Suites create their own users and remove them afterwards.
 */
export default defineConfig({
  testDir: './e2e',
  // Locally the dev server compiles each screen on its first request: warm them all up first.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  // Locally one dev server renders for every worker: past four, its queue made pages slower than the
  // tests wait. CI keeps Playwright's default against the production build.
  workers: process.env.CI ? undefined : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // Locally the dev server is shared by every worker: a long test (many screens and saves) may need
  // more than the default 30 s when others load it too. Each step still waits 10 s at most.
  timeout: process.env.CI ? 30_000 : 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'es-CO',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The slow-network tests run apart, after the rest (see «loading» below).
      testIgnore: /loading\.spec\.ts$/,
    },
    // The whole accessibility audit again on a device in dark mode (spec 010, CA-03), and the look
    // of spec 019 in dark.
    {
      name: 'chromium-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
      testMatch: /(a11y|style)\.spec\.ts$/,
    },
    // Spec 011 measures times on a slowed network (a skeleton at 300 ms, a bar at 120 ms): with the
    // rest of the suite loading the same server, a slow screen sometimes showed something else.
    // They run once everything else has finished.
    {
      name: 'loading',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /loading\.spec\.ts$/,
      dependencies: ['chromium', 'chromium-dark'],
    },
  ],
  webServer: {
    // CI runs against the production build that the pipeline already produced.
    command: process.env.CI ? 'pnpm start' : 'pnpm dev',
    url: `${baseURL}/auth/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
