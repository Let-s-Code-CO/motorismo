/**
 * Brands and lines come from a catalog that suggests while typing and grows on its own (spec 005,
 * HU-02).
 *
 * Guards CA-10 ("suz" suggests Suzuki and, with Suzuki, "gsx" suggests GSX-R600; only brands of the
 * chosen type and lines of the chosen brand), CA-12 (case, spaces and hyphens do not matter),
 * CA-13 (a really new brand is saved and suggested next time) and CA-14 (written differently, it is
 * not added twice).
 */
import { type Locator, type Page, expect, test } from '@playwright/test';

import {
  SEED,
  adminClient,
  createWalkInCustomer,
  deleteCatalogBrands,
  deleteCustomers,
  signIn,
  uniquePlate,
} from './support/sandbox';

// Tests of this file run in parallel workers: each removes only what it created.
const created: string[] = [];
const createdBrands: string[] = [];

test.afterAll(async () => {
  await deleteCustomers(created);
  for (const brand of createdBrands) await deleteCatalogBrands(brand);
});

const openForm = async (page: Page) => {
  const id = await createWalkInCustomer(`E2E Catálogo ${Date.now()}`);
  created.push(id);
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto(`/customers/${id}`);
  await page.getByRole('button', { name: 'Agregar vehículo' }).click();
  return page.getByRole('dialog', { name: 'Agregar vehículo' });
};

const field = (dialog: Locator, name: string) => dialog.getByRole('combobox', { name });

/** Closes the suggestions keeping what was typed (Escape would close the whole dialog). */
const leaveField = (page: Page) => page.keyboard.press('Tab');

test('suggests brands of the chosen type and lines of the chosen brand (CA-10, CA-12)', async ({
  page,
}) => {
  const dialog = await openForm(page);

  await field(dialog, 'Marca').fill('suz');
  await page.getByRole('option', { name: 'Suzuki', exact: true }).click();
  await field(dialog, 'Línea').fill('gsxr 600');
  await expect(page.getByRole('option', { name: 'GSX-R600', exact: true })).toBeVisible();
  await leaveField(page);

  // A car: the brand is emptied, and Suzuki (car) has no motorcycle lines.
  await dialog.getByRole('radio', { name: 'Carro' }).check();
  await expect(field(dialog, 'Marca')).toHaveValue('');
  await field(dialog, 'Marca').fill('suz');
  await page.getByRole('option', { name: 'Suzuki', exact: true }).click();
  await field(dialog, 'Línea').fill('gsx');
  await expect(page.getByRole('option', { name: 'GSX-R600', exact: true })).toHaveCount(0);
  await field(dialog, 'Línea').fill('swi');
  await expect(page.getByRole('option', { name: 'Swift', exact: true })).toBeVisible();
});

test('adds a really new brand and line to the catalog, once (CA-13, CA-14)', async ({ page }) => {
  const brand = `E2E Marca ${Date.now()}`;
  createdBrands.push(brand);
  const dialog = await openForm(page);

  await field(dialog, 'Marca').fill(brand);
  await expect(dialog.getByText('Nueva: se añadirá al catálogo.').first()).toBeVisible();
  await leaveField(page);
  await field(dialog, 'Línea').fill('Modelo X-1');
  await leaveField(page);
  await dialog.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: 'Rojo', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(uniquePlate('motorcycle'));
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Vehículo agregado.')).toBeVisible();

  // Next time it is suggested (CA-13)…
  await page.getByRole('button', { name: 'Agregar vehículo' }).click();
  const again = page.getByRole('dialog', { name: 'Agregar vehículo' });
  await field(again, 'Marca').fill(brand.slice(0, 12).toLowerCase());
  await page.getByRole('option', { name: brand, exact: true }).click();
  await field(again, 'Línea').fill('modelo x1');
  await expect(page.getByRole('option', { name: 'Modelo X-1', exact: true })).toBeVisible();
  await leaveField(page);

  // …and written differently it is the same brand and line (CA-14).
  await field(again, 'Marca').fill(brand.toUpperCase().replace(' ', '-'));
  await leaveField(page);
  await field(again, 'Línea').fill('MODELO X 1');
  await leaveField(page);
  await again.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: 'Azul', exact: true }).click();
  await again.getByRole('textbox', { name: 'Placa' }).fill(uniquePlate('motorcycle'));
  await again.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: brand })).toHaveCount(2);

  const { data: brands } = await adminClient()
    .from('vehicle_brands')
    .select('id, name')
    .ilike('name', `${brand}%`);
  expect(brands).toHaveLength(1);
  const { data: lines } = await adminClient()
    .from('vehicle_lines')
    .select('name')
    .eq('brand_id', brands![0]!.id);
  expect(lines).toEqual([{ name: 'Modelo X-1' }]);
});
