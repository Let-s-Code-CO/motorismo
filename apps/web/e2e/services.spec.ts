/**
 * «Servicios» (spec 007, HU-01, HU-03, HU-04), with the local seeds (seeds/04_catalogs.sql).
 *
 * - CA-01 / CA-02: an admin registers a service with a price for two vehicle types; the third
 *   shows «No disponible».
 * - CA-04: the same name with other capitals is refused.
 * - CA-05: an admin corrects a price.
 * - CA-12 / CA-13: disabling asks first and moves it to «Desactivados», from where it comes back.
 * - CA-15: an operator reads the services without any action.
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, adminClient, signIn } from './support/sandbox';

const name = `E2E Servicio ${Date.now()}`;

test.afterAll(async () => {
  await adminClient().from('services').delete().eq('name', name);
});

const openServices = async (page: Page, email: string) => {
  await signIn(page, email);
  await expect(page).toHaveURL('/');
  await page.goto('/services');
  await expect(page.getByRole('heading', { name: 'Servicios', level: 1 })).toBeVisible();
};

const rowOf = (page: Page, text: string) => page.getByRole('row', { name: new RegExp(text) });

/**
 * Opens the row actions menu and picks an item. The list refreshes from the server right after a
 * change, which redraws the rows (and closes an open menu): retry until it holds.
 */
const chooseAction = async (page: Page, service: string, item: string) => {
  await expect(async () => {
    await page.getByRole('button', { name: `Acciones de ${service}` }).click();
    await page.getByRole('menuitem', { name: item }).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
};

test('an admin registers, corrects, disables and reactivates a service (CA-01 to CA-05, CA-12, CA-13)', async ({
  page,
}) => {
  await openServices(page, SEED.admin.email);

  // CA-01, CA-02: register with two prices.
  await page.getByRole('button', { name: 'Nuevo servicio' }).click();
  let dialog = page.getByRole('dialog', { name: /Nuevo servicio/ });
  await dialog.getByLabel('Nombre del servicio').fill(name);
  await dialog.getByLabel('Moto').fill('30000');
  await dialog.getByLabel('Carro').fill('50.000');
  await dialog.getByRole('button', { name: 'Registrar servicio' }).click();
  await expect(page.getByText('Servicio registrado.')).toBeVisible();
  await expect(rowOf(page, name)).toContainText('$ 30.000');
  await expect(rowOf(page, name)).toContainText('$ 50.000');
  await expect(rowOf(page, name)).toContainText('No disponible');

  // CA-04: the same name with other capitals and spaces is taken.
  await page.getByRole('button', { name: 'Nuevo servicio' }).click();
  dialog = page.getByRole('dialog', { name: /Nuevo servicio/ });
  await dialog.getByLabel('Nombre del servicio').fill(`  ${name.toUpperCase()} `);
  await dialog.getByLabel('Moto').fill('1');
  await dialog.getByRole('button', { name: 'Registrar servicio' }).click();
  await expect(dialog.getByText('Ya existe un servicio con ese nombre.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();

  // CA-05: correct, adding the bicycle price.
  await chooseAction(page, name, 'Editar');
  dialog = page.getByRole('dialog', { name: /Editar servicio/ });
  await expect(dialog.getByLabel('Moto')).toHaveValue('30.000');
  await dialog.getByLabel('Bicicleta').fill('20000');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Servicio actualizado.')).toBeVisible();
  await expect(rowOf(page, name)).toContainText('$ 20.000');

  // CA-12: disabling asks first, then the service leaves the active list.
  await chooseAction(page, name, 'Desactivar');
  const confirm = page.getByRole('dialog', { name: new RegExp(`¿Desactivar «${name}»?`) });
  await confirm.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByText('Servicio desactivado.')).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Servicios activos' })).not.toContainText(name);

  // CA-13: it is in «Desactivados», with its date, and comes back.
  await page.getByRole('button', { name: /^Desactivados \(\d+\)$/ }).click();
  const disabled = page.getByRole('grid', { name: 'Servicios desactivados' });
  await expect(disabled.getByRole('row', { name: new RegExp(name) })).toContainText(
    'Desactivado el'
  );
  await chooseAction(page, name, 'Reactivar');
  await expect(page.getByText('Servicio reactivado.')).toBeVisible();
  await expect(page.getByRole('grid', { name: 'Servicios activos' })).toContainText(name);
});

test('an operator reads the active services, without any action (CA-15)', async ({ page }) => {
  await openServices(page, SEED.operator.email);

  await expect(rowOf(page, 'Lavado sencillo')).toContainText('$ 25.000');
  await expect(page.getByText('Polichado')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nuevo servicio' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Acciones de/ })).toHaveCount(0);
});
