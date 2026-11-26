/**
 * «Servicios» (spec 007, HU-01, HU-03, HU-04), with the local seeds (seeds/04_catalogs.sql).
 *
 * - CA-01 / CA-02: an admin registers a service with a price for two vehicle types; the third
 *   is not named on its card (spec 024).
 * - CA-04: the same name with other capitals is refused.
 * - CA-05: an admin corrects a price.
 * - CA-12 / CA-13: disabling asks first and moves it to «Desactivados», from where it comes back.
 * - CA-15: an operator reads the services without any action.
 * - Spec 024: the price list of every environment (CA-17) shows a value range for the services by
 *   category and «A convenir» for PPF, with their descriptions (CA-09, CA-19); an admin registers a
 *   service by category with its eight values (CA-07) and turns it «a convenir» (CA-12).
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, adminClient, signIn } from './support/sandbox';

const name = `E2E Servicio ${Date.now()}`;
const byCategoryName = `E2E Por categoría ${Date.now()}`;

test.afterAll(async () => {
  await adminClient().from('services').delete().in('name', [name, byCategoryName]);
});

const openServices = async (page: Page, email: string) => {
  await signIn(page, email);
  await expect(page).toHaveURL('/');
  await page.goto('/services');
  await expect(page.getByRole('heading', { name: 'Servicios', level: 1 })).toBeVisible();
};

/** The card of a service, by its whole name. */
const cardOf = (page: Page, name: string) => page.getByRole('article', { name, exact: true });

/**
 * Opens the card actions menu and picks an item. The list refreshes from the server right after a
 * change, which redraws the cards (and closes an open menu): retry until it holds.
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
  await dialog.getByRole('textbox', { name: 'Moto', exact: true }).fill('30000');
  await dialog.getByLabel('Carro').fill('50.000');
  await dialog.getByRole('button', { name: 'Registrar servicio' }).click();
  await expect(page.getByText('Servicio registrado.')).toBeVisible();
  await expect(cardOf(page, name)).toContainText('$ 30.000');
  await expect(cardOf(page, name)).toContainText('$ 50.000');
  // CA-02 (amended by spec 024): the card names no type it is not offered for.
  await expect(cardOf(page, name)).not.toContainText('Bicicleta');

  // CA-04: the same name with other capitals and spaces is taken.
  await page.getByRole('button', { name: 'Nuevo servicio' }).click();
  dialog = page.getByRole('dialog', { name: /Nuevo servicio/ });
  await dialog.getByLabel('Nombre del servicio').fill(`  ${name.toUpperCase()} `);
  await dialog.getByRole('textbox', { name: 'Moto', exact: true }).fill('1');
  await dialog.getByRole('button', { name: 'Registrar servicio' }).click();
  await expect(dialog.getByText('Ya existe un servicio con ese nombre.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();

  // CA-05: correct, adding the bicycle price.
  await chooseAction(page, name, 'Editar');
  dialog = page.getByRole('dialog', { name: /Editar servicio/ });
  await expect(dialog.getByRole('textbox', { name: 'Moto', exact: true })).toHaveValue('30.000');
  await dialog.getByLabel('Bicicleta').fill('20000');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Servicio actualizado.')).toBeVisible();
  await expect(cardOf(page, name)).toContainText('$ 20.000');

  // CA-12: disabling asks first, then the service leaves the active list.
  await chooseAction(page, name, 'Desactivar');
  const confirm = page.getByRole('dialog', { name: new RegExp(`¿Desactivar «${name}»?`) });
  await confirm.getByRole('button', { name: 'Desactivar' }).click();
  await expect(page.getByText('Servicio desactivado.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Servicios activos' })).not.toContainText(name);

  // CA-13: it is in «Desactivados», with its date, and comes back.
  await page.getByRole('button', { name: /^Desactivados \(\d+\)$/ }).click();
  const disabled = page.getByRole('list', { name: 'Servicios desactivados' });
  await expect(disabled.getByRole('article', { name, exact: true })).toContainText(
    'Desactivado el'
  );
  await chooseAction(page, name, 'Reactivar');
  await expect(page.getByText('Servicio reactivado.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Servicios activos' })).toContainText(name);
});

test('an operator reads the active services, without any action (CA-15)', async ({ page }) => {
  await openServices(page, SEED.operator.email);

  await expect(cardOf(page, 'Lavado sencillo')).toContainText('$ 40.000');
  await expect(page.getByText('Polichado')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nuevo servicio' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Acciones de/ })).toHaveCount(0);
});

test('the price list shows Pro Wash by category and PPF «a convenir», with what they include (spec 024, CA-09, CA-17, CA-19)', async ({
  page,
}) => {
  await openServices(page, SEED.operator.email);

  // Pro Wash: from the Scooter's $ 42.000 to the Maxi Trail's $ 52.000.
  const proWash = cardOf(page, 'Lavado Pro Wash');
  await expect(proWash).toContainText('$ 42.000 a $ 52.000');
  await expect(proWash).toContainText('Shampoo alcalino');
  await expect(
    proWash.getByRole('list', { name: 'Valores por categoría de Lavado Pro Wash' })
  ).toContainText('Maxi Trail');
  await expect(cardOf(page, 'Limpieza de asientos')).toContainText('$ 16.000');
  await expect(cardOf(page, 'PPF')).toContainText('A convenir');
});

test('an admin registers a service by category with its eight values, then turns it «a convenir» (spec 024, CA-07, CA-12)', async ({
  page,
}) => {
  await openServices(page, SEED.admin.email);

  await page.getByRole('button', { name: 'Nuevo servicio' }).click();
  let dialog = page.getByRole('dialog', { name: /Nuevo servicio/ });
  await dialog.getByLabel('Nombre del servicio').fill(byCategoryName);
  await dialog.getByRole('radio', { name: /Por categoría/ }).check();
  const values = [
    ['Street/Roadster', '30000'],
    ['SBK/SSP', '32000'],
    ['Scooter', '28000'],
    ['Maxi Scooter', '31000'],
    ['Trail', '33000'],
    ['Maxi Trail', '36000'],
    ['Cruiser/Clásica', '30000'],
    ['Maxi Cruiser', '34000'],
  ];
  // CA-07: all eight, or none.
  await dialog.getByLabel('Street/Roadster', { exact: true }).fill('30000');
  await dialog.getByRole('button', { name: 'Registrar servicio' }).click();
  await expect(dialog.getByText('Escribe el valor de esta categoría.')).toHaveCount(7);
  for (const [category, value] of values)
    await dialog.getByLabel(category!, { exact: true }).fill(value!);
  await dialog.getByRole('button', { name: 'Registrar servicio' }).click();
  await expect(page.getByText('Servicio registrado.')).toBeVisible();
  await expect(cardOf(page, byCategoryName)).toContainText('$ 28.000 a $ 36.000');

  // CA-12: «a convenir» has no value nor time.
  await chooseAction(page, byCategoryName, 'Editar');
  dialog = page.getByRole('dialog', { name: /Editar servicio/ });
  await dialog.getByRole('switch', { name: /A convenir/ }).check();
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Servicio actualizado.')).toBeVisible();
  await expect(cardOf(page, byCategoryName)).toContainText('A convenir');
  await expect(cardOf(page, byCategoryName)).not.toContainText('$');
});
