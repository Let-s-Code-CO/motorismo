/**
 * Sign-in through the real app, proxy and local Supabase (spec 002, HU-01).
 * CA-01 name and role after signing in · CA-02 same message for any wrong credentials ·
 * CA-03 back to the requested page · CA-05 no login page while signed in · CA-06 disabled account.
 */
import { expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

test('an active user signs in and sees their name and role (CA-01)', async ({ page }) => {
  await signIn(page, SEED.admin.email);

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: `Hola, ${SEED.admin.name}` })).toBeVisible();
  await expect(page.getByText('Tu rol: Administrador')).toBeVisible();
});

test('a wrong password and an unknown email show the same message (CA-02)', async ({ page }) => {
  // Next.js has its own role="alert" (route announcer): match the message text.
  await signIn(page, SEED.admin.email, 'wrong-password');
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);

  await signIn(page, 'nadie@motorismo.test', 'wrong-password');
  await expect(page.getByText('Correo o contraseña incorrectos.')).toBeVisible();
});

test('an internal page leads to the login and back to it after signing in (CA-03)', async ({
  page,
}) => {
  await page.goto('/admin/users');
  await expect(page).toHaveURL('/auth/login?next=%2Fadmin%2Fusers');

  await page.getByLabel('Correo').fill(SEED.admin.email);
  await page.getByLabel('Contraseña').fill(SEED.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/admin/users');
  await expect(page.getByRole('heading', { name: 'Usuarios' })).toBeVisible();
});

test('a signed-in user who opens the login page goes home (CA-05)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await page.goto('/auth/login');

  await expect(page).toHaveURL('/');
});

test('a disabled account cannot sign in and is told why (CA-06)', async ({ page }) => {
  await signIn(page, SEED.disabled.email);

  await expect(
    page.getByText('Tu cuenta está desactivada. Contacta al administrador.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
});
