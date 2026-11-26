/**
 * «Ciudades de placa», a tab of «Marcas y líneas» (spec 023, HU-03), against the local database.
 *
 * - CA-10: an admin gives Bogotá, D.C. its own legend («STFE DE BOGOTA»); the plate of a car of
 *   Bogotá (Valentina's KDM-482, seeds) shows it; clearing it brings the name back («BOGOTA, D.C.»).
 * - CA-11: an operator has no «Marcas y líneas», and the address answers that they have no permission.
 * - RN-04: only the cities that issue plates are listed.
 */
import { type Page, expect, test } from '@playwright/test';

import { untilHydrated } from './support/hydration';
import { SEED, SEED_CUSTOMERS, adminClient, signIn } from './support/sandbox';

const BOGOTA = '11001';

// Leave Bogotá, D.C. with its name, whatever happened in the test.
test.afterAll(async () => {
  await adminClient().from('municipalities').update({ plate_legend: null }).eq('code', BOGOTA);
});

const valentinaPlate = async (page: Page) => {
  await page.goto('/customers');
  await page
    .getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) })
    .first()
    .click();
  return page.getByRole('region', { name: 'Vehículos' }).locator('[data-plate]').first();
};

test('an admin gives Bogotá, D.C. its own legend, its cars show it, and clearing it brings the name back (CA-10, RN-04)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/admin/vehicle-catalog');
  await page.getByRole('link', { name: 'Ciudades de placa' }).click();
  await expect(page.getByRole('heading', { name: 'Ciudades de placa', level: 1 })).toBeVisible();
  // RN-04: the 294 cities of the RUNT's transit authorities.
  await expect(page.getByText('294 ciudades')).toBeVisible();

  // Hydrated first: typed or tapped before, the search and the dialog do nothing.
  await untilHydrated(page.getByLabel('Buscar ciudad'));
  await page.getByLabel('Buscar ciudad').fill('bogota');
  await page.getByRole('button', { name: 'Cambiar leyenda de Bogotá, D.C.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Leyenda de Bogotá, D.C.' });
  await dialog.getByLabel('Leyenda en la placa').fill('stfe de bogota');
  await expect(dialog.locator('[data-plate]')).toHaveAttribute('data-legend', 'STFE DE BOGOTA');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(
    page.getByRole('region', { name: 'Avisos' }).getByText('Leyenda guardada.')
  ).toBeVisible();

  await expect(await valentinaPlate(page)).toHaveAttribute('data-legend', 'STFE DE BOGOTA');

  await page.goto('/admin/vehicle-catalog/plate-cities');
  // Hydrated first: typed or tapped before, the search and the dialog do nothing.
  await untilHydrated(page.getByLabel('Buscar ciudad'));
  await page.getByLabel('Buscar ciudad').fill('bogota');
  await page.getByRole('button', { name: 'Cambiar leyenda de Bogotá, D.C.' }).click();
  await page.getByRole('button', { name: 'Quitar leyenda' }).click();
  await expect(
    page.getByRole('region', { name: 'Avisos' }).getByText('Leyenda quitada.')
  ).toBeVisible();

  await expect(await valentinaPlate(page)).toHaveAttribute('data-legend', 'BOGOTA, D.C.');
});

test('an operator cannot open «Ciudades de placa» (CA-11)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await page.goto('/admin/vehicle-catalog/plate-cities');

  await expect(page.getByRole('heading', { name: 'Ciudades de placa' })).toHaveCount(0);
  await expect(page.getByText(/permiso/i).first()).toBeVisible();
});
