/**
 * Disabling and reactivating accounts (spec 002, HU-04), with two real browsers.
 * CA-19 the disabled user's NEXT action sends them to the login with the message ·
 * CA-20 once reactivated they sign in with their usual password ·
 * CA-21 the only active admin cannot change their own account and is told why.
 */
import { expect, test } from '@playwright/test';

import { SEED, createActiveUser, deleteUsersByEmail, signIn, uniqueEmail } from './support/sandbox';

const email = uniqueEmail('disable');
const name = `Olivia Prueba ${Date.now()}`;

test.beforeAll(() => createActiveUser({ email, fullName: name }));
test.afterAll(() => deleteUsersByEmail([email]));

test('a disabled user is removed on their next action and can return once reactivated', async ({
  page,
  browser,
}) => {
  // The operator is working, with an open session.
  const operatorContext = await browser.newContext();
  const operator = await operatorContext.newPage();
  await signIn(operator, email);
  await expect(operator.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible();

  // The admin disables them.
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/admin/users');
  const row = page.getByRole('row', { name: new RegExp(name) });
  await page.getByRole('button', { name: `Acciones de ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Desactivar' }).click();
  await expect(row.getByText('Desactivado', { exact: true })).toBeVisible();

  // CA-19: the operator's next action.
  await operator.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(operator).toHaveURL('/auth/login?error=account_disabled');
  await expect(
    operator.getByText('Tu cuenta está desactivada. Contacta al administrador.')
  ).toBeVisible();

  // CA-20: reactivated, they sign in with the same password.
  await page.getByRole('button', { name: `Acciones de ${name}` }).click();
  await page.getByRole('menuitem', { name: 'Reactivar' }).click();
  await expect(row.getByText('Activo', { exact: true })).toBeVisible();
  await signIn(operator, email);
  await expect(operator.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible();
  await operatorContext.close();
});

test('the only active admin cannot change their own account and is told why (CA-21)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/admin/users');

  const own = page.getByRole('row', { name: new RegExp(SEED.admin.name) });
  await expect(own.getByText('Debe existir al menos un administrador activo.')).toBeVisible();
  await expect(own.getByRole('button')).toHaveCount(0);
});
