/**
 * What a signed-in customer can and cannot reach (spec 004, HU-02 and CA-12).
 *
 * Guards CA-12 (they land on "Mi perfil"), CA-08 (their menu only offers "Mi perfil"), CA-09
 * (staff pages answer "no permission" with a link to their profile) and CA-11 (customers and staff
 * never mix: no customer in user management, no staff member in Clientes).
 */
import { expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

test('a customer lands on "Mi perfil" and only sees that option (CA-12, CA-08)', async ({
  page,
}) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);

  await expect(page).toHaveURL('/profile');
  const menu = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(menu.getByRole('link')).toHaveText(['Mi perfil']);
  await expect(page.getByText('Cliente', { exact: true }).first()).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL('/profile');
});

test('staff pages answer "no permission" with a way back to the profile (CA-09)', async ({
  page,
}) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);
  await expect(page).toHaveURL('/profile');

  for (const path of ['/customers', '/admin/users']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
    ).toBeVisible();
  }
  await page.getByRole('link', { name: 'Ir a mi perfil' }).click();
  await expect(page).toHaveURL('/profile');
});

test('customers and staff never mix in the lists (CA-11)', async ({ page }) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto('/admin/users');
  await expect(page.getByRole('row', { name: new RegExp(SEED.operator.name) })).toBeVisible();
  await expect(page.getByText(SEED_CUSTOMERS.customer.name)).toHaveCount(0);

  await page.goto(`/customers?q=${encodeURIComponent(SEED.operator.email)}`);
  await expect(page.getByText('No hay clientes que coincidan con tu búsqueda.')).toBeVisible();
});
