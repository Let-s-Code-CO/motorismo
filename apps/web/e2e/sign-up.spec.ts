/**
 * A customer creates their account with email and password (spec 004, HU-01).
 *
 * Guards CA-01 (form reachable from the login), CA-02 (confirmation email, no entry yet), CA-03
 * (the link opens "Mi perfil"), CA-04 (unconfirmed sign-in → confirm + re-send), CA-05 (a used
 * link is invalid and offers a new email) and CA-06 (errors next to each field).
 */
import { expect, test } from '@playwright/test';

import {
  confirmLinkFromEmail,
  deleteUsersByEmail,
  publicClient,
  signIn,
  uniqueEmail,
} from './support/sandbox';

const PASSWORD = 'cliente-nuevo-1';
const created: string[] = [];

test.afterAll(() => deleteUsersByEmail(created));

test('signs up, confirms the email and lands on "Mi perfil" (CA-01, CA-02, CA-03)', async ({
  page,
}) => {
  const email = uniqueEmail('signup');
  created.push(email);

  await page.goto('/auth/login');
  await page.getByRole('link', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL('/auth/sign-up');
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();

  await page.getByLabel('Nombre completo').fill('Camila Nueva');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Celular (opcional)').fill('300 123 4567');
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox', { name: /Autorizo el tratamiento de mis datos/ }).check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByText('Te enviamos un correo para confirmar tu cuenta.')).toBeVisible();

  await page.goto(await confirmLinkFromEmail(email));
  await expect(page).toHaveURL('/my');
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
  await expect(page.getByLabel('Nombre completo')).toHaveValue('Camila Nueva');
  await expect(page.getByLabel('Celular (opcional)')).toHaveValue('300 123 4567');
});

test('an unconfirmed account is asked to confirm and can get the email again (CA-04)', async ({
  page,
}) => {
  const email = uniqueEmail('pending');
  created.push(email);
  await publicClient().auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { full_name: 'Pedro Pendiente', data_consent: true } },
  });

  await signIn(page, email, PASSWORD);

  await expect(page.getByText('Confirma tu correo para entrar.')).toBeVisible();
  await expect(page).toHaveURL('/auth/login');
  // Auth allows one email per second to the same address.
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Reenviar correo de confirmación' }).click();
  await expect(
    page.getByText('Si tu cuenta está pendiente de confirmar, te enviamos un nuevo correo.')
  ).toBeVisible();
});

test('a used confirmation link is not valid and offers a new email (CA-05)', async ({ page }) => {
  const email = uniqueEmail('usedlink');
  created.push(email);
  await publicClient().auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { full_name: 'Úrsula Usada', data_consent: true } },
  });
  const link = await confirmLinkFromEmail(email);
  await page.goto(link);
  await expect(page).toHaveURL('/my');

  await page.goto(link);

  await expect(page).toHaveURL('/auth/invalid-link?type=email');
  await expect(page.getByText('Este enlace de confirmación caducó o ya se usó.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reenviar correo de confirmación' })).toBeVisible();
});

test('shows each error next to its field and creates nothing (CA-06)', async ({ page }) => {
  await page.goto('/auth/sign-up');

  await page.getByLabel('Correo').fill('camila');
  await page.getByLabel('Celular (opcional)').fill('12345');
  await page.getByLabel('Contraseña', { exact: true }).fill('corta');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByText('Introduce tu nombre.')).toBeVisible();
  await expect(page.getByText('Introduce un correo válido.')).toBeVisible();
  await expect(
    page.getByText('Introduce un celular colombiano de 10 dígitos que empiece por 3.')
  ).toBeVisible();
  await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
  await expect(
    page.getByText('Debes autorizar el tratamiento de tus datos para crear la cuenta.')
  ).toBeVisible();
  await expect(page).toHaveURL('/auth/sign-up');
});
