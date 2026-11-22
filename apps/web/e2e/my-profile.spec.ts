/**
 * "Mi perfil": a customer keeps their data up to date (spec 004, HU-03).
 *
 * Guards CA-12 (their data is shown), CA-13 (changes are saved and staff see them on the record)
 * and CA-14 (an invalid phone is rejected; the email cannot be changed).
 */
import { expect, test } from '@playwright/test';

import {
  SEED,
  createCustomerAccount,
  deleteUsersByEmail,
  signIn,
  uniqueEmail,
} from './support/sandbox';

const email = uniqueEmail('profile');

test.beforeAll(() =>
  createCustomerAccount({ email, fullName: 'Paula Perfil', phone: '3001112233' })
);
test.afterAll(() => deleteUsersByEmail([email]));

test('the customer updates name and phone, and staff see the change (CA-12, CA-13, CA-14)', async ({
  browser,
}) => {
  const customer = await browser.newPage();
  await signIn(customer, email);
  await expect(customer).toHaveURL('/my');
  await customer.goto('/profile');

  await expect(customer.getByLabel('Nombre completo')).toHaveValue('Paula Perfil');
  await expect(customer.getByLabel('Correo')).toHaveValue(email);
  await expect(customer.getByLabel('Correo')).toHaveAttribute('readonly', '');
  await expect(customer.getByText(/^Cliente desde el /)).toBeVisible();

  await customer.getByLabel('Celular (opcional)').fill('12345');
  await customer.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(
    customer.getByText('Introduce un celular colombiano de 10 dígitos que empiece por 3.')
  ).toBeVisible();

  await customer.getByLabel('Nombre completo').fill('Paula Pérez');
  await customer.getByLabel('Celular (opcional)').fill('+57 311 222 3344');
  await customer.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(customer.getByText('Tus datos se guardaron.')).toBeVisible();

  const staff = await browser.newPage();
  await signIn(staff, SEED.operator.email);
  await expect(staff).toHaveURL('/');
  await staff.goto(`/customers?q=${encodeURIComponent(email)}`);
  await staff.getByRole('link', { name: /Paula Pérez/ }).click();
  await expect(staff.getByRole('heading', { name: 'Paula Pérez' })).toBeVisible();
  await expect(staff.getByText('311 222 3344')).toBeVisible();
});
