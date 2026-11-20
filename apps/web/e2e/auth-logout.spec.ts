/**
 * Sign-out (spec 002, CA-04): after signing out, internal pages are unreachable, also through the
 * browser's back button or by typing their URL. On a phone, «Cerrar sesión» lives in the avatar's
 * menu (spec 009, CA-04).
 */
import { expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

test('after signing out, back and direct URLs lead to the login (CA-04)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page.getByRole('heading', { name: `Hola, ${SEED.operator.name}` })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL('/auth/login');

  // No reload: what the browser shows right after "back" must not be the internal page.
  await page.goBack();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole('heading', { name: /Hola/ })).toHaveCount(0);

  await page.goto('/');
  await expect(page).toHaveURL('/auth/login');
});

test.describe('on a phone (spec 009)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("signs out from the avatar's menu (CA-04)", async ({ page }) => {
    await signIn(page, SEED.operator.email);
    await expect(page.getByRole('heading', { name: `Hola, ${SEED.operator.name}` })).toBeVisible();

    await page.getByRole('button', { name: /tu cuenta$/i }).click();
    // Who is signed in heads the menu (the header's own name is hidden on a phone).
    await expect(page.getByText(SEED.operator.name, { exact: true }).last()).toBeVisible();
    await page
      .getByRole('menu', { name: 'Tu cuenta' })
      .getByRole('menuitem', { name: 'Cerrar sesión' })
      .click();

    await expect(page).toHaveURL('/auth/login');
  });
});
