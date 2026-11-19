/**
 * Password recovery (spec 002, HU-05), with the real email read from Mailpit.
 * CA-22 the same neutral message for any email · CA-23 the link sets a new password that works
 * while the old one stops working · CA-24 the link works only once.
 */
import { expect, test } from '@playwright/test';

import {
  SEED,
  confirmLinkFromEmail,
  createActiveUser,
  deleteUsersByEmail,
  signIn,
  uniqueEmail,
} from './support/sandbox';

const email = uniqueEmail('reset');
const name = `Rita Prueba ${Date.now()}`;
const NEUTRAL =
  'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.';

test.beforeAll(() => createActiveUser({ email, fullName: name }));
test.afterAll(() => deleteUsersByEmail([email]));

const requestReset = async (page: import('@playwright/test').Page, address: string) => {
  await page.goto('/auth/login');
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  // Wait for the new page: the login page also has a "Correo" field.
  await expect(page.getByRole('heading', { name: 'Recupera tu contraseña' })).toBeVisible();
  await page.getByLabel('Correo').fill(address);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
};

test('an unknown email gets exactly the same answer (CA-22)', async ({ page }) => {
  await requestReset(page, 'nadie@motorismo.test');

  await expect(page.getByText(NEUTRAL)).toBeVisible();
});

test('a user recovers their password with the emailed link, which works only once', async ({
  page,
  browser,
}) => {
  await requestReset(page, email);
  await expect(page.getByText(NEUTRAL)).toBeVisible();

  // CA-23: the link sets a new password.
  const link = await confirmLinkFromEmail(email);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Crea una nueva contraseña' })).toBeVisible();
  await page.getByLabel('Nueva contraseña').fill('otra-clave-segura');
  await page.getByLabel('Repite la contraseña').fill('otra-clave-segura');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL('/auth/login');

  await signIn(page, email, SEED.password);
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
  await signIn(page, email, 'otra-clave-segura');
  await expect(page.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible();

  // CA-24: the same link again.
  const again = await browser.newContext();
  const againPage = await again.newPage();
  await againPage.goto(link);
  await expect(againPage).toHaveURL('/auth/invalid-link?type=recovery');
  await expect(againPage.getByRole('link', { name: 'Pedir un enlace nuevo' })).toBeVisible();
  await again.close();
});
