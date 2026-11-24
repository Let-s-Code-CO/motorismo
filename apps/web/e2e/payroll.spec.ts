/**
 * «Reportes» → «Liquidación» (spec 016), in a real browser against the local database. The seeds
 * register the employees 90 days ago with a base salary, so last month has everyone; the test
 * closes it, regenerates it and downloads it, and removes its payroll before and after (with the
 * secret key), so it can run again.
 *
 * - CA-05 / CA-12: the month in progress is provisional and cannot be closed yet.
 * - CA-05 / CA-11: last month, an employee's detail with the count of their base salary.
 * - CA-14: closing asks first and then says by whom and when.
 * - CA-16: regenerating asks first and then says by whom and when.
 * - CA-18: «Exportar a Excel» downloads «liquidacion-AAAA-MM.xlsx», not empty.
 * - CA-20: an operator is told they have no permission, and the download answers 403.
 */
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { openAdminSection } from './support/nav';
import { SEED, adminClient, signIn } from './support/sandbox';
import { toast } from './support/toasts';

/** Last month, `YYYY-MM`, in Colombia. */
const lastMonth = (() => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [year, month] = today.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
})();

const removeLastMonthPayroll = async () => {
  await adminClient().from('payrolls').delete().eq('month', `${lastMonth}-01`);
};

test.beforeAll(removeLastMonthPayroll);
test.afterAll(removeLastMonthPayroll);

test.describe('the admin', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('sees the month in progress as provisional, last month in detail, closes it, regenerates it and downloads it (CA-05, CA-11, CA-12, CA-14, CA-16, CA-18)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    // From «Reportes», its tab «Liquidación»: the month in progress.
    await openAdminSection(page, 'Reportes');
    await page
      .getByRole('navigation', { name: 'Secciones de reportes' })
      .getByRole('link', { name: 'Liquidación' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Liquidación de empleados', level: 1 })
    ).toBeVisible();
    await expect(page.getByText('Provisional')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar liquidación' })).toHaveCount(0);

    // Last month: the employees of the seeds, and one in detail.
    await page.getByRole('link', { name: 'Mes anterior' }).click();
    await expect(page).toHaveURL(`/reports/payroll?month=${lastMonth}`);
    const table = page.getByRole('table', { name: 'Liquidación por empleado' });
    await table.getByRole('link', { name: 'Elkin Estrada' }).click();
    await expect(page.getByRole('heading', { name: 'Elkin Estrada', level: 1 })).toBeVisible();
    await expect(page.getByText(/^\d+ de \d+ días de \$ 1\.423\.500 = \$ [\d.]+$/)).toBeVisible();
    await page.getByRole('link', { name: 'Volver a la liquidación' }).click();
    await expect(page).toHaveURL(`/reports/payroll?month=${lastMonth}`);

    // CA-14: close it, asked first.
    await page.getByRole('button', { name: 'Cerrar liquidación' }).click();
    const close = page.getByRole('dialog', { name: /^¿Cerrar la liquidación de / });
    await close.getByRole('button', { name: 'Cerrar liquidación' }).click();
    await expect(toast(page, `Liquidación de`)).toContainText('cerrada.');
    await expect(
      page.getByText(new RegExp(`^Cerrada el .* por ${SEED.admin.name}$`))
    ).toBeVisible();
    await expect(page.getByText('Provisional')).toHaveCount(0);

    // CA-16: regenerate it, warned first.
    await page.getByRole('button', { name: 'Regenerar' }).click();
    const regenerate = page.getByRole('dialog', { name: /^¿Regenerar la liquidación de / });
    await expect(regenerate).toContainText('Los valores pueden cambiar');
    await regenerate.getByRole('button', { name: 'Regenerar' }).click();
    await expect(
      page.getByText(
        new RegExp(`^Regenerada el .* por ${SEED.admin.name}; antes sumaba \\$ [\\d.]+\\.$`)
      )
    ).toBeVisible();

    // CA-18: the Excel of the month.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Exportar a Excel' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`liquidacion-${lastMonth}.xlsx`);
    const file = await readFile((await download.path())!);
    expect(file.subarray(0, 2).toString()).toBe('PK');
    expect(file.length).toBeGreaterThan(1000);
  });
});

test('an operator has no payroll and no file (CA-20)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await page.goto(`/reports/payroll?month=${lastMonth}`);
  await expect(page.getByText('No tienes permiso para ver esta página.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  const response = await page.request.get(`/reports/payroll/export?month=${lastMonth}`);
  expect(response.status()).toBe(403);
});
