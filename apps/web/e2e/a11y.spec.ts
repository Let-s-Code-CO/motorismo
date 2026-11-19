/**
 * Automatic accessibility audit (spec 003, CA-04): WCAG 2.1 A/AA rules, colour contrast included,
 * on the login, the home page and user management; spec 004 adds the sign-up, the data policy,
 * "Mi perfil", Clientes and a customer record. Serious and critical findings fail the test.
 */
import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

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
 * Waits until the dialog finished its opening animation: mid-fade, colours are blended and axe
 * would measure a contrast nobody sees.
 */
const untilDialogSettled = async (page: Page) => {
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        let opacity = 1;
        for (let el = document.querySelector('[role="dialog"]'); el; el = el.parentElement) {
          opacity *= Number(getComputedStyle(el).opacity);
        }
        return opacity;
      })
    )
    .toBe(1);
};

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
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});
