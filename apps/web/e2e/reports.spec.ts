/**
 * «Reportes» → «Servicios» (spec 015), in a real browser against the local database, on the
 * closed orders of the seeds: Valentina's #1 (10 days ago) and Camila's #2 (3 days ago, «Lavado
 * sencillo» and «Micropulido» on her Suzuki UIH-03D).
 *
 * - CA-01: the admin opens «Reportes» from the menu and lands on the report.
 * - CA-04 / CA-05: filtering by Camila's plate, typed in lower case with a dash, leaves only her
 *   services; the filter is in the address and survives a reload.
 * - CA-10: a service opens its order.
 * - CA-12: «Exportar a Excel» downloads «servicios-…-a-….xlsx», not empty.
 * - The filters are drawn on the server: the page hydrates without errors.
 * - CA-09 / CA-14: an operator has no «Reportes», is told they have no permission, and the download
 *   answers 403.
 */
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { SEED, signIn } from './support/sandbox';

/** A day of Colombia, `days` before today. */
const bogotaDay = (days = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date(Date.now() - days * 24 * 60 * 60_000)
  );

/** From before the seeds' first closed order to today, so the test never depends on the month. */
const PERIOD = `from=${bogotaDay(15)}&to=${bogotaDay()}`;

test.describe('the admin', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('opens «Reportes», filters by a plate that survives a reload, and opens an order (CA-01, CA-04, CA-05, CA-10)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Reportes' })
      .click();
    await expect(page).toHaveURL(/\/reports\/services$/);
    await expect(
      page.getByRole('heading', { name: 'Reporte de servicios', level: 1 })
    ).toBeVisible();

    await page.goto(`/reports/services?${PERIOD}`);
    const table = page.getByRole('table', { name: 'Servicios hechos' });
    await expect(table.getByRole('row', { name: /Valentina/ }).first()).toBeVisible();
    await expect(table.getByRole('row', { name: /Micropulido/ }).first()).toBeVisible();

    await page.getByRole('textbox', { name: 'Placa' }).fill('uih-03d');
    await expect(page).toHaveURL(/plate=UIH03D/);
    await expect(table.getByRole('row', { name: /Valentina/ })).toHaveCount(0);
    await expect(table.getByRole('row', { name: /Lavado sencillo/ }).first()).toBeVisible();

    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Placa' })).toHaveValue('UIH-03D');
    await expect(table.getByRole('row', { name: /Valentina/ })).toHaveCount(0);
    await expect(table.getByRole('row', { name: /Micropulido/ }).first()).toBeVisible();

    await table
      .getByRole('row', { name: /Micropulido/ })
      .first()
      .getByRole('link', { name: /^Orden #\d+$/ })
      .click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  });

  test('renders on the server and the browser alike: no hydration error (its filters are drawn on the server)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(`/reports/services?${PERIOD}`);
    await expect(page.getByRole('table', { name: 'Servicios hechos' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    expect(errors).toEqual([]);
  });

  test('downloads the report as an Excel file named by its period (CA-12)', async ({ page }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/reports/services?${PERIOD}`);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Exportar a Excel' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe(`servicios-${bogotaDay(15)}-a-${bogotaDay()}.xlsx`);
    const file = await readFile((await download.path())!);
    // An .xlsx is a zip: «PK», and more than its empty shell.
    expect(file.subarray(0, 2).toString()).toBe('PK');
    expect(file.length).toBeGreaterThan(1000);
  });
});

test('an operator has no «Reportes», no permission to the report, and no file (CA-09, CA-14)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await expect(
    page
      .getByRole('navigation', { name: 'Navegación principal' })
      .getByRole('link', { name: 'Órdenes' })
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reportes' })).toHaveCount(0);

  await page.goto(`/reports/services?${PERIOD}`);
  await expect(page.getByText('No tienes permiso para ver esta página.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  const response = await page.request.get(`/reports/services/export?${PERIOD}`);
  expect(response.status()).toBe(403);
});
