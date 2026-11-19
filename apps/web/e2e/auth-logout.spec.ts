/**
 * Sign-out (spec 002, CA-04): after signing out, internal pages are unreachable, also through the
 * browser's back button or by typing their URL.
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
