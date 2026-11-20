/**
 * Automatic accessibility audit (spec 003, CA-04): WCAG 2.1 A/AA rules, colour contrast included,
 * on the login, the home page and user management; spec 004 adds the sign-up, the data policy,
 * "Mi perfil", Clientes and a customer record; spec 005 the vehicles of a customer ("Mis vehículos"
 * in "Mi perfil" too), the vehicle form, the retired vehicles and the retire dialog. Serious and critical findings fail the test.
 */
import AxeBuilder from '@axe-core/playwright';
import { type Locator, type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`);
};

/**
 * Waits until an overlay (a dialog, a list of suggestions) finished its opening animation:
 * mid-fade, colours are blended and axe would measure a contrast nobody sees.
 */
const untilSettled = async (overlay: Locator) => {
  await expect(overlay).toBeVisible();
  await expect
    .poll(() =>
      overlay.evaluate((node) => {
        let opacity = 1;
        for (let el: Element | null = node; el; el = el.parentElement) {
          opacity *= Number(getComputedStyle(el).opacity);
        }
        return opacity;
      })
    )
    .toBe(1);
};

const untilDialogSettled = (page: Page) => untilSettled(page.getByRole('dialog'));

test('the login has no serious accessibility issues (CA-04)', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('home and user management have no serious accessibility issues (CA-04)', async ({ page }) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  expect(await audit(page)).toEqual([]);

  await page.goto('/admin/users');
  await expect(page.getByRole('grid')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('sign-up and data policy have no serious accessibility issues (spec 004)', async ({
  page,
}) => {
  await page.goto('/auth/sign-up');
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.goto('/privacy');
  await expect(
    page.getByRole('heading', { name: 'Política de tratamiento de datos personales' })
  ).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('"Mi perfil" has no serious accessibility issues (spec 004)', async ({ page }) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);
  await expect(page).toHaveURL('/profile');
  await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('Clientes and a customer record have no serious accessibility issues (spec 004)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto('/customers');
  await expect(page.getByRole('grid')).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
  await expect(page.getByRole('heading', { name: SEED_CUSTOMERS.walkIn.name })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('the new-customer dialog and the edit form have no serious accessibility issues (spec 004)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto('/customers');
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);

  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
  await page.getByRole('button', { name: 'Editar datos' }).click();
  await untilDialogSettled(page);
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('the vehicles of a customer and the vehicle form have no serious accessibility issues (spec 005)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  // Valentina has a vehicle in the seeds (a Mazda CX-30): the list with its colour and plate.
  await page.goto('/customers');
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
  const vehicles = page.getByRole('region', { name: 'Vehículos' });
  await expect(vehicles.getByText('Mazda CX-30')).toBeVisible();
  expect(await audit(page)).toEqual([]);

  // The form, then with the brand suggestions and the colour list open (keyboard: CA-15).
  await vehicles.getByRole('button', { name: 'Agregar vehículo' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);

  const dialog = page.getByRole('dialog', { name: 'Agregar vehículo' });
  await dialog.getByRole('combobox', { name: 'Marca' }).fill('ya');
  await untilSettled(page.getByRole('option', { name: 'Yamaha' }));
  expect(await audit(page)).toEqual([]);
  // Tab leaves the brand; the line opens its suggestions on focus, Tab leaves it too.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  await dialog.getByRole('button', { name: /Color/ }).focus();
  await page.keyboard.press('Enter');
  await untilSettled(page.getByRole('option', { name: 'Vinotinto' }));
  expect(await audit(page)).toEqual([]);

  // A car: the plate city with Bogotá, D.C., and its list of 1,104 cities open (HU-07, CA-28).
  await page.keyboard.press('Escape');
  await dialog.getByRole('radio', { name: 'Carro' }).check();
  await dialog.getByRole('combobox', { name: 'Ciudad de la placa' }).click();
  await untilSettled(page.getByRole('option', { name: /La Calera/ }));
  expect(await audit(page)).toEqual([]);
});

test('retired vehicles and the retire dialog have no serious accessibility issues (spec 005)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  // Camila (seeds) has UIH-03D active and JWJ-07 retired.
  await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
  const vehicles = page.getByRole('region', { name: 'Vehículos' });
  await vehicles.getByRole('button', { name: 'Vehículos retirados (1)' }).click();
  await expect(vehicles.getByRole('list', { name: 'Vehículos retirados (1)' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await vehicles.getByRole('button', { name: 'Retirar Suzuki GSX-R600' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
});
