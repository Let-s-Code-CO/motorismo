/**
 * The whole invitation journey (spec 002, HU-03), with the real email read from Mailpit.
 * CA-11 the admin invites and the person appears as "Invitado" ·
 * CA-14 the link lets them create a password and enter, becoming "Activo" ·
 * CA-15 the same link opened again is no longer valid.
 */
import { expect, test } from '@playwright/test';

import {
  SEED,
  confirmLinkFromEmail,
  deleteUsersByEmail,
  signIn,
  uniqueEmail,
} from './support/sandbox';

const email = uniqueEmail('invite');
// Unique per run so rows never collide with leftovers of an interrupted run.
const name = `Iván Prueba ${Date.now()}`;

test.afterAll(() => deleteUsersByEmail([email]));

test('an invited person creates their password and enters; the link works only once', async ({
  page,
  browser,
}) => {
  // CA-11: the admin invites.
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Invitar usuario' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre completo').fill(name);
  await dialog.getByLabel('Correo').fill(email);
  await dialog.getByRole('radio', { name: 'Operador' }).check({ force: true });
  await dialog.getByRole('button', { name: 'Enviar invitación' }).click();

  await expect(page.getByRole('status')).toHaveText(`Invitación enviada a ${email}.`);
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row.getByText('Invitado', { exact: true })).toBeVisible();

  // CA-14: the invited person opens the email link in their own browser.
  const link = await confirmLinkFromEmail(email);
  const invitee = await browser.newContext();
  const inviteePage = await invitee.newPage();
  await inviteePage.goto(link);
  await expect(inviteePage.getByRole('heading', { name: 'Crea tu contraseña' })).toBeVisible();
  await inviteePage.getByLabel('Nueva contraseña').fill('una-clave-segura');
  await inviteePage.getByLabel('Repite la contraseña').fill('una-clave-segura');
  await inviteePage.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(inviteePage.getByRole('heading', { name: `Hola, ${name}` })).toBeVisible();
  await expect(inviteePage.getByText('Tu rol: Operador')).toBeVisible();
  await invitee.close();

  await page.reload();
  await expect(row.getByText('Activo', { exact: true })).toBeVisible();

  // CA-15: the same link, opened again, is no longer valid.
  const again = await browser.newContext();
  const againPage = await again.newPage();
  await againPage.goto(link);
  await expect(againPage).toHaveURL('/auth/invalid-link?type=invite');
  await expect(
    againPage.getByText(
      'Este enlace de invitación caducó o ya se usó. Pide al administrador que te reenvíe la invitación.'
    )
  ).toBeVisible();
  await again.close();
});
