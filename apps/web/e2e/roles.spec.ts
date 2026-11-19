/**
 * Role permissions in the UI (spec 002, HU-02).
 * CA-07 an operator does not see admin options · CA-08 an admin URL shows "No tienes permiso…".
 */
import { expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

test('an operator does not see user management (CA-07)', async ({ page }) => {
  await signIn(page, SEED.operator.email);

  await expect(page.getByRole('link', { name: 'Inicio' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
});

test('an operator opening an admin URL is told they have no permission (CA-08)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await page.goto('/admin/users');

  await expect(
    page.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
  ).toBeVisible();
  // HeroUI tables are exposed as ARIA grids.
  await expect(page.getByRole('grid')).toHaveCount(0);
  await page.getByRole('link', { name: 'Volver al inicio' }).click();
  await expect(page).toHaveURL('/');
});

test('an admin sees user management', async ({ page }) => {
  await signIn(page, SEED.admin.email);

  await page.getByRole('link', { name: 'Usuarios' }).click();

  await expect(page.getByRole('grid', { name: 'Usuarios de la aplicación' })).toBeVisible();
});
