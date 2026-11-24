/**
 * Staff (operator and admin) disable and reactivate customers (spec 004, HU-07, RN-09).
 *
 * Guards CA-29 (a disabled customer with an open session is signed out with the message on their
 * next action), CA-22 (a disabled customer cannot sign in), CA-30 (reactivated, they can sign in
 * again) and RN-09 / CA-32 (staff — an operator too — disable and reactivate from the row actions
 * menu of «Clientes»).
 */
import { expect, test } from '@playwright/test';

import { chooseRowAction } from './support/menus';
import {
  SEED,
  SEED_CUSTOMERS,
  createCustomerAccount,
  createWalkInCustomer,
  deleteCustomers,
  deleteUsersByEmail,
  signIn,
  uniqueEmail,
} from './support/sandbox';

const email = uniqueEmail('todisable');

test.beforeAll(() => createCustomerAccount({ email, fullName: 'Diego Desactivable' }));
const walkInIds: string[] = [];
test.afterAll(async () => {
  await deleteUsersByEmail([email]);
  await deleteCustomers(walkInIds);
});

test('a disabled seed customer cannot sign in (CA-22)', async ({ page }) => {
  await signIn(page, SEED_CUSTOMERS.disabled.email);

  await expect(
    page.getByText('Tu cuenta está desactivada. Contacta al administrador.')
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('the admin disables a signed-in customer, who is signed out; reactivated, they can enter (CA-29, CA-30)', async ({
  browser,
}) => {
  const customer = await browser.newPage();
  await signIn(customer, email);
  await expect(customer).toHaveURL('/my');

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
  await expect(customer).toHaveURL('/my');
});

test('an operator disables and reactivates a customer from the row menu of «Clientes» (RN-09, CA-32)', async ({
  page,
}) => {
  const name = `E2E Menú Clientes ${Date.now()}`;
  walkInIds.push(await createWalkInCustomer(name));
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto(`/customers?q=${encodeURIComponent(name)}`);
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('Sin cuenta');

  await chooseRowAction(page, name, 'Desactivar cliente', row);
  await expect(
    page.getByText(
      'Cliente desactivado. Si tiene una sesión abierta, se cerrará en su siguiente acción.'
    )
  ).toBeVisible();
  await expect(row).toContainText('Desactivado');

  await chooseRowAction(page, name, 'Reactivar cliente', row);
  await expect(page.getByText('Cliente reactivado.')).toBeVisible();
  await expect(row).toContainText('Sin cuenta');
});
