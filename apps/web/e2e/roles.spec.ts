/**
 * Role permissions in the UI (spec 002, HU-02).
 * CA-07 an operator does not see admin options · CA-08 an admin URL shows "No tienes permiso…".
 * Spec 007: staff find «Servicios» and «Empleados» in the menu and on their home page (CA-19); a
 * customer opening them is told they have no permission (CA-18).
 * Spec 009 (CA-02, RN-01): on a phone, «Menú» opens a side panel with exactly the role's sections,
 * and choosing one goes there.
 */
import { expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

test('an operator does not see user management (CA-07)', async ({ page }) => {
  await signIn(page, SEED.operator.email);

  await expect(page.getByRole('link', { name: 'Inicio', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Usuarios', exact: true })).toHaveCount(0);
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

  await page.getByRole('link', { name: 'Usuarios', exact: true }).click();

  await expect(page.getByRole('grid', { name: 'Usuarios de la aplicación' })).toBeVisible();
});

test('staff find «Servicios» and «Empleados» in the menu and on their home page (spec 007, CA-19)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  const nav = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(nav.getByRole('link', { name: 'Servicios', exact: true })).toHaveAttribute(
    'href',
    '/services'
  );
  await expect(nav.getByRole('link', { name: 'Empleados', exact: true })).toHaveAttribute(
    'href',
    '/employees'
  );
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: /Servicios/ })).toHaveAttribute('href', '/services');
  await expect(main.getByRole('link', { name: /Empleados/ })).toHaveAttribute('href', '/employees');
  await expect(main.getByRole('link', { name: /Gestionar usuarios/ })).toHaveCount(0);
});

test('a customer opening «Servicios» or «Empleados» is told they have no permission (spec 007, CA-18)', async ({
  page,
}) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);
  await expect(page).toHaveURL('/my');

  for (const path of ['/services', '/employees']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
    ).toBeVisible();
    await expect(page.getByRole('grid')).toHaveCount(0);
  }
});

test.describe('on a phone (spec 009)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the panel shows an operator no «Usuarios» and an admin does see it (CA-02, RN-01)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: 'Menú' }).click();
    const panel = page.getByRole('dialog', { name: 'Menú principal' });
    await expect(panel.getByRole('link', { name: 'Clientes' })).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
  });

  test('an admin goes to «Usuarios» from the panel (CA-02)', async ({ page }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: 'Menú' }).click();
    const panel = page.getByRole('dialog', { name: 'Menú principal' });

    await panel.getByRole('link', { name: 'Usuarios' }).click();

    await expect(page).toHaveURL('/admin/users');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('grid', { name: 'Usuarios de la aplicación' })).toBeVisible();
  });
});
