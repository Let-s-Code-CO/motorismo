import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E against the real app and the LOCAL Supabase with its seeds (`pnpm db:start` / `db:reset`).
 * Emails are read from Mailpit. Suites create their own users and remove them afterwards.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'es-CO',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // The whole accessibility audit again on a device in dark mode (spec 010, CA-03), and the look
    // of spec 019 in dark.
    {
      name: 'chromium-dark',
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
      testMatch: /(a11y|style)\.spec\.ts$/,
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
