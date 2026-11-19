/**
 * Only an admin disables and reactivates customers (spec 004, HU-07).
 *
 * Guards CA-29 (a disabled customer with an open session is signed out with the message on their
 * next action), CA-22 (a disabled customer cannot sign in), CA-30 (reactivated, they can sign in
 * again) and CA-31 (an operator is not offered the option).
 */
import { expect, test } from '@playwright/test';

import {
  SEED,
  SEED_CUSTOMERS,
  createCustomerAccount,
  deleteUsersByEmail,
  signIn,
  uniqueEmail,
} from './support/sandbox';

const email = uniqueEmail('todisable');

test.beforeAll(() => createCustomerAccount({ email, fullName: 'Diego Desactivable' }));
test.afterAll(() => deleteUsersByEmail([email]));

test('a disabled seed customer cannot sign in (CA-22)', async ({ page }) => {
  await signIn(page, SEED_CUSTOMERS.disabled.email);

  await expect(
    page.getByText('Tu cuenta está desactivada. Contacta al administrador.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('an operator is not offered to disable a customer (CA-31)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();

  await expect(page.getByRole('button', { name: 'Editar datos' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Desactivar cliente' })).toHaveCount(0);
});

test('the admin disables a signed-in customer, who is signed out; reactivated, they can enter (CA-29, CA-30)', async ({
  browser,
}) => {
  const customer = await browser.newPage();
  await signIn(customer, email);
  await expect(customer).toHaveURL('/profile');

  const admin = await browser.newPage();
  await signIn(admin, SEED.admin.email);
  await expect(admin).toHaveURL('/');
  await admin.goto(`/customers?q=${encodeURIComponent(email)}`);
  await admin.getByRole('link', { name: /Diego Desactivable/ }).click();
  await admin.getByRole('button', { name: 'Desactivar cliente' }).click();
  await expect(
    admin.getByText(
      'Cliente desactivado. Si tiene una sesión abierta, se cerrará en su siguiente acción.'
    )
  ).toBeVisible();
  await expect(admin.getByText('Desactivado', { exact: true })).toBeVisible();

  await customer.reload();
  await expect(customer).toHaveURL(/\/auth\/login\?error=account_disabled/);
  await expect(
    customer.getByText('Tu cuenta está desactivada. Contacta al administrador.')
  ).toBeVisible();

  await admin.getByRole('button', { name: 'Reactivar cliente' }).click();
  await expect(admin.getByText('Cliente reactivado.')).toBeVisible();

  await signIn(customer, email);
  await expect(customer).toHaveURL('/profile');
});
