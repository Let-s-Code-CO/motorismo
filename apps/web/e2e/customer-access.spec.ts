/**
 * What a signed-in customer can and cannot reach (spec 004, HU-02 and CA-12).
 *
 * Guards CA-12 (they land on their «Inicio», spec 014), CA-08 (their menu offers only their own
 * sections), CA-09 (staff pages answer "no permission" with a link to their «Inicio»), CA-11 (customers and staff
 * never mix: no customer in user management, no staff member in Clientes), RF-02 (a customer who
 * had asked for a staff page lands on their «Inicio» after signing in) and RF-06 (customers recover
 * their password like staff).
 */
import { expect, test } from '@playwright/test';

import {
  SEED,
  SEED_CUSTOMERS,
  confirmLinkFromEmail,
  createCustomerAccount,
  deleteUsersByEmail,
  signIn,
  uniqueEmail,
} from './support/sandbox';

test('a customer lands on their «Inicio» and only sees their sections (CA-12, CA-08; spec 014)', async ({
  page,
}) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);

  await expect(page).toHaveURL('/my');
  const menu = page.getByRole('navigation', { name: 'Navegación principal' });
  await expect(menu.getByRole('link')).toHaveText([
    'Inicio',
    'Mis reservas',
    'Historial',
    'Mi perfil',
  ]);
  await expect(page.getByText('Cliente', { exact: true }).first()).toBeVisible();

  await page.goto('/');
  await expect(page).toHaveURL('/my');
});

test('staff pages answer "no permission" with a way back to their «Inicio» (CA-09; spec 014)', async ({
  page,
}) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);
  await expect(page).toHaveURL('/my');

  for (const path of ['/customers', '/admin/users']) {
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
    ).toBeVisible();
  }
  await page.getByRole('link', { name: 'Ir a mi inicio' }).click();
  await expect(page).toHaveURL('/my');
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

test('a customer who had asked for a staff page lands on their «Inicio» after signing in (RF-02; spec 014)', async ({
  page,
}) => {
  await page.goto('/customers');
  await expect(page).toHaveURL('/auth/login?next=%2Fcustomers');

  await page.getByLabel('Correo').fill(SEED_CUSTOMERS.customer.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(SEED.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/my');
});

test('a customer recovers their password and lands on their «Inicio» (RF-06; spec 014)', async ({
  page,
}) => {
  const email = uniqueEmail('customerreset');
  await createCustomerAccount({ email, fullName: 'Rosa Recupera' });
  try {
    await page.goto('/auth/forgot-password');
    await page.getByLabel('Correo').fill(email);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(
      page.getByText(
        'Si el correo está registrado, recibirás un enlace para crear una nueva contraseña.'
      )
    ).toBeVisible();

    await page.goto(await confirmLinkFromEmail(email));
    await expect(page.getByRole('heading', { name: 'Crea una nueva contraseña' })).toBeVisible();
    await page.getByLabel('Nueva contraseña').fill('nueva-clave-cliente');
    await page.getByLabel('Repite la contraseña').fill('nueva-clave-cliente');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page).toHaveURL('/my');

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/auth/login');
    await signIn(page, email, 'nueva-clave-cliente');
    await expect(page).toHaveURL('/my');
  } finally {
    await deleteUsersByEmail([email]);
  }
});
