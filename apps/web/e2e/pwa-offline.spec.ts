/**
 * Without network, a notice and nothing to operate (spec 006, HU-02), on «Clientes» as an operator.
 *
 * - CA-06: when the connection drops, the «Sin conexión» notice shows.
 * - CA-07: meanwhile nothing responds, not even an open dialog (the app is inert).
 * - CA-08: back online, the notice goes and what was typed is still there, ready to save.
 * - CA-09 / RN-02: reloading without network shows the app's "Sin conexión" page, with nobody's
 *   data, instead of the browser's error.
 * - CA-11: with the network back, «Reintentar» lands on the page being opened.
 * - CA-10: when the network drops just as a form is sent, no success is reported, the notice shows
 *   and what was typed stays.
 * - Spec 010, CA-08: the «Sin conexión» page follows the device's theme, or the one chosen on it.
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, adminClient, signIn } from './support/sandbox';

const NOTICE = 'Sin conexión. No puedes guardar ni consultar nada hasta que vuelva la red.';
// Tests of this file run in parallel workers: each removes only what it created.
const createdNames: string[] = [];

test.afterAll(async () => {
  if (createdNames.length)
    await adminClient().from('customers').delete().in('full_name', createdNames);
});

const openCustomers = async (page: Page) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
};

/** Whether an element sits inside something inert (it cannot be clicked, typed in or focused). */
const isInert = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => element.closest('[inert]') !== null);

test('without network, «Sin conexión» shows and nothing responds; back online, what was typed is kept and saves (CA-06, CA-07, CA-08)', async ({
  page,
  context,
}) => {
  const name = `E2E Sin Red ${Date.now()}`;
  createdNames.push(name);
  await openCustomers(page);
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  const dialog = page.getByRole('dialog', { name: /Nuevo cliente/ });
  await dialog.getByLabel('Nombre completo').fill(name);
  await dialog.getByLabel('Celular (opcional)').fill('312 000 2222');

  await context.setOffline(true);

  await expect(page.getByRole('alert').filter({ hasText: NOTICE })).toBeVisible();
  // The page and the open dialog are inert: still on screen, but nothing can be operated.
  expect(await isInert(page, 'main')).toBe(true);
  expect(await isInert(page, '[role="dialog"]')).toBe(true);
  await expect(page.locator('button', { hasText: 'Registrar cliente' })).toBeVisible();
  await expect(
    page.locator('button', { hasText: 'Registrar cliente' }).click({ timeout: 1_500 })
  ).rejects.toThrow();

  await context.setOffline(false);

  await expect(page.getByRole('alert').filter({ hasText: NOTICE })).toHaveCount(0);
  await expect(dialog.getByLabel('Nombre completo')).toHaveValue(name);
  await expect(dialog.getByLabel('Celular (opcional)')).toHaveValue('312 000 2222');
  await dialog.getByRole('checkbox', { name: /El cliente autorizó/ }).check();
  await dialog.getByRole('button', { name: 'Registrar cliente' }).click();
  await expect(page.getByText('Cliente registrado.')).toBeVisible();
});

test('reloading without network shows the "Sin conexión" page; «Reintentar» lands back on the page (CA-09, CA-11, RN-02)', async ({
  page,
  context,
}) => {
  await openCustomers(page);
  await expect(page.getByText(SEED_CUSTOMERS.customer.name).first()).toBeVisible();
  // The service worker must control the page before the network drops.
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
    .toBe(true);

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Sin conexión', level: 1 })).toBeVisible();
  await expect(page).toHaveURL('/customers');
  await expect(page.getByText(SEED_CUSTOMERS.customer.name)).toHaveCount(0);

  await context.setOffline(false);
  await page.getByRole('button', { name: 'Reintentar' }).click();

  await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible();
  await expect(page).toHaveURL('/customers');
});

test.describe('«Sin conexión» in dark mode (spec 010, CA-08)', () => {
  const pageBackground = (page: Page) =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  const offlinePage = async (page: Page, context: import('@playwright/test').BrowserContext) => {
    await page.goto('/auth/login');
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sin conexión', level: 1 })).toBeVisible();
  };

  test.describe('on a dark device', () => {
    test.use({ colorScheme: 'dark' });

    test('the page is dark', async ({ page, context }) => {
      await offlinePage(page, context);
      expect(await pageBackground(page)).toBe('rgb(9, 9, 11)');
    });
  });

  test('on a light device that chose «Oscuro», the page is dark', async ({ page, context }) => {
    await context.addCookies([
      { name: 'motorismo-theme', value: 'dark', url: 'http://localhost:3000' },
    ]);
    await offlinePage(page, context);
    expect(await pageBackground(page)).toBe('rgb(9, 9, 11)');
  });
});

test.describe('the network drops while sending (CA-10)', () => {
  // The Server Action request is cut with page.route, which only sees it without a service worker.
  test.use({ serviceWorkers: 'block' });

  test('reports no success, shows «Sin conexión» and keeps what was typed', async ({ page }) => {
    const name = `E2E Envío Cortado ${Date.now()}`;
    await openCustomers(page);
    await page.getByRole('button', { name: 'Nuevo cliente' }).click();
    const dialog = page.getByRole('dialog', { name: /Nuevo cliente/ });
    await dialog.getByLabel('Nombre completo').fill(name);
    await dialog.getByLabel('Celular (opcional)').fill('312 000 3333');
    await dialog.getByRole('checkbox', { name: /El cliente autorizó/ }).check();

    // A Server Action is a POST to the page's own address.
    await page.route('**/customers', (route) =>
      route.request().method() === 'POST' ? route.abort('internetdisconnected') : route.continue()
    );
    await dialog.getByRole('button', { name: 'Registrar cliente' }).click();

    await expect(page.getByRole('alert').filter({ hasText: NOTICE })).toBeVisible();
    await expect(page.getByText('Cliente registrado.')).toHaveCount(0);
    await expect(dialog.getByLabel('Nombre completo')).toHaveValue(name);
    await expect(dialog.getByLabel('Celular (opcional)')).toHaveValue('312 000 3333');
    const { count } = await adminClient()
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('full_name', name);
    expect(count).toBe(0);
  });
});
