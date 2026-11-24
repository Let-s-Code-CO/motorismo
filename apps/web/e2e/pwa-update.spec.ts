/**
 * New version notice (spec 006, HU-04), on «Clientes» as an operator.
 *
 * - CA-15: when a new version is live, coming back to the app's window shows «Hay una versión
 *   nueva» with «Actualizar».
 * - CA-17: the app does not reload by itself: what is being typed stays while the notice shows.
 * - CA-16: «Actualizar» loads the live version on the same page.
 * - In dark mode too, the notice is opaque: the page under it never shows through (spec 010).
 *
 * The "new version" is simulated by answering /api/version with another one.
 */
import { expect, test } from '@playwright/test';

import { floatsOpaque } from './support/banners';
import { SEED, signIn } from './support/sandbox';

// /api/version is answered with page.route, which only sees requests without a service worker.
test.use({ serviceWorkers: 'block' });

test('offers «Actualizar» when a new version is live, never reloads by itself, and updates on the same page (CA-15, CA-16, CA-17)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  const search = page.getByRole('searchbox', { name: 'Buscar clientes' });
  await search.fill('Camila');

  await page.route('**/api/version', (route) => route.fulfill({ json: { version: 'e2e-new' } }));
  // Coming back to the app's window (headless Chromium is always visible: fire the event).
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(page.getByText('Hay una versión nueva')).toBeVisible();
  await expect(search).toHaveValue('Camila');

  // Nothing reloads by itself: a marker set on this page survives.
  await page.evaluate(() => Object.assign(window, { __stillHere: true }));
  await page.waitForTimeout(1_000);
  expect(await page.evaluate(() => '__stillHere' in window)).toBe(true);

  await page.unroute('**/api/version');
  await page.getByRole('button', { name: 'Actualizar' }).click();

  await expect.poll(() => page.evaluate(() => '__stillHere' in window)).toBe(false);
  await expect(page).toHaveURL(/\/customers/);
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
  await expect(page.getByText('Hay una versión nueva')).toHaveCount(0);
});

test.describe('in dark mode (spec 010)', () => {
  test.use({ colorScheme: 'dark' });

  test('the notice is opaque: the page under it never shows through (CA-15)', async ({ page }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.route('**/api/version', (route) => route.fulfill({ json: { version: 'e2e-new' } }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const notice = page.getByText('Hay una versión nueva');
    await expect(notice).toBeVisible();

    expect(await floatsOpaque(notice)).toBe(true);
  });
});
