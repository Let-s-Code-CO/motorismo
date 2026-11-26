/**
 * «Reportes» → «Liquidación» (spec 020; by month in spec 016), in a real browser against the local
 * database. The seeds register the employees 90 days ago with a base salary, so the fortnight before
 * this one has everyone; the test closes it, regenerates it with the other method and downloads it,
 * and removes its payroll before and after (with the secret key), so it can run again.
 *
 * - CA-01, CA-05: the fortnight in progress is provisional and cannot be closed yet; «Quincena
 *   anterior» goes back one.
 * - CA-04: an employee's detail with the count of their base salary, and back to the same period.
 * - CA-11, CA-12: closing asks first and then says by whom and when; a reload keeps it (CA-10).
 * - CA-13, CA-16: «Días reales» chosen on the closed fortnight says regenerating will use it, and
 *   regenerating does.
 * - CA-06, CA-08: two dates chosen are a «Consulta» that is never closed, with the way back.
 * - CA-17: «Exportar a Excel» downloads the file named by its fortnight, not empty.
 * - spec 016, RN-08: an operator is told they have no permission, and the download answers 403.
 */
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import { openAdminSection } from './support/nav';
import { SEED, adminClient, signIn } from './support/sandbox';
import { toast } from './support/toasts';

/** Today in Colombia, `YYYY-MM-DD`. */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
/** The first day of the fortnight before this one. */
const previous = (() => {
  const [year, month, day] = today.split('-').map(Number) as [number, number, number];
  if (day > 15) return `${today.slice(0, 8)}01`;
  return new Date(Date.UTC(year, month - 2, 16)).toISOString().slice(0, 10);
})();
/** How the address writes it: `2026-11-1`. */
const previousParam = `${previous.slice(0, 7)}-${previous.endsWith('-01') ? 1 : 2}`;

const removePreviousPayroll = async () => {
  await adminClient().from('payrolls').delete().eq('period_start', previous);
};

// One worker for the whole file: with tests in parallel, each worker would run these hooks and remove
// the closing another test has just made.
test.describe.configure({ mode: 'serial' });
test.beforeAll(removePreviousPayroll);
test.afterAll(removePreviousPayroll);

test.describe('the admin', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('sees the fortnight in progress, the one before in detail, closes it, regenerates it by «Días reales» and downloads it (CA-01, CA-04, CA-05, CA-10 to CA-13, CA-16, CA-17)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    // From «Reportes», its tab «Liquidación»: the fortnight in progress.
    await openAdminSection(page, 'Reportes');
    await page
      .getByRole('navigation', { name: 'Secciones de reportes' })
      .getByRole('link', { name: 'Liquidación' })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Liquidación de empleados', level: 1 })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: /quincena de/, level: 2 })).toBeVisible();
    await expect(page.getByText('Provisional')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar liquidación' })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /Mes comercial/ })).toBeChecked();

    // The fortnight before: the employees of the seeds, and one in detail.
    await page.getByRole('link', { name: 'Quincena anterior' }).click();
    await expect(page).toHaveURL(`/reports/payroll?fortnight=${previousParam}`);
    const table = page.getByRole('table', { name: 'Liquidación por empleado' });
    await table.getByRole('link', { name: 'Elkin Estrada' }).click();
    await expect(page.getByRole('heading', { name: 'Elkin Estrada', level: 1 })).toBeVisible();
    await expect(page.getByText(/^\d+ días de 30 × \$ 1\.423\.500 = \$ [\d.,]+$/)).toBeVisible();
    await page.getByRole('link', { name: 'Volver a la liquidación' }).click();
    await expect(page).toHaveURL(`/reports/payroll?fortnight=${previousParam}`);

    // CA-11: close it, asked first.
    await page.getByRole('button', { name: 'Cerrar liquidación' }).click();
    const close = page.getByRole('dialog', { name: /^¿Cerrar la liquidación de la / });
    await close.getByRole('button', { name: 'Cerrar liquidación' }).click();
    await expect(toast(page, 'Liquidación de la')).toContainText('cerrada.');
    await expect(
      page.getByText(new RegExp(`^Cerrada el .* por ${SEED.admin.name}$`))
    ).toBeVisible();
    await expect(page.getByText('Salario base por «Mes comercial».')).toBeVisible();
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Provisional')).toHaveCount(0);

    // CA-13, CA-16: «Días reales» chosen; regenerating uses it.
    await page.getByRole('radio', { name: /Días reales/ }).check();
    await expect(page.getByRole('radio', { name: /Días reales/ })).toBeChecked();
    await expect(page).toHaveURL(`/reports/payroll?fortnight=${previousParam}&base=actual`);
    await expect(page.getByText('Al regenerarla se calculará por «Días reales».')).toBeVisible();
    await page.getByRole('button', { name: 'Regenerar' }).click();
    const regenerate = page.getByRole('dialog', { name: /^¿Regenerar la liquidación de la / });
    await expect(regenerate).toContainText('Los valores pueden cambiar');
    await regenerate.getByRole('button', { name: 'Regenerar' }).click();
    await expect(
      page.getByText(
        new RegExp(`^Regenerada el .* por ${SEED.admin.name}; antes sumaba \\$ [\\d.]+\\.$`)
      )
    ).toBeVisible();
    await expect(page.getByText('Salario base por «Días reales».')).toBeVisible();
    await expect(page.getByText(/^Al regenerarla/)).toHaveCount(0);

    // CA-17: the Excel of the fortnight.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: 'Exportar a Excel' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(
      `liquidacion-${previous.slice(0, 7)}-${previous.endsWith('-01') ? 1 : 2}a-quincena.xlsx`
    );
    const file = await readFile((await download.path())!);
    expect(file.subarray(0, 2).toString()).toBe('PK');
    expect(file.length).toBeGreaterThan(1000);
  });

  test('chooses two dates: a query that is never closed, and back to the fortnight in progress (CA-06, CA-08)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/reports/payroll?fortnight=${previousParam}`);
    // The page is drawn on the server; a date typed before it hydrates would reach no handler.
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Hasta').fill(today);
    await expect(page).toHaveURL(`/reports/payroll?from=${previous}&to=${today}`);
    await expect(page.getByRole('heading', { name: /^Del /, level: 2 })).toBeVisible();
    await expect(page.getByText('Consulta')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar liquidación' })).toHaveCount(0);
    await expect(page.getByRole('table', { name: 'Liquidación por empleado' })).toBeVisible();

    await page.getByRole('link', { name: 'Volver a la quincena en curso' }).click();
    await expect(page.getByText('Provisional')).toBeVisible();
    await expect(page.getByText('Consulta')).toHaveCount(0);
  });
});

test('an operator has no payroll and no file (spec 016, RN-08)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await page.goto(`/reports/payroll?fortnight=${previousParam}`);
  await expect(page.getByText('No tienes permiso para ver esta página.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  const response = await page.request.get(`/reports/payroll/export?fortnight=${previousParam}`);
  expect(response.status()).toBe(403);
});
