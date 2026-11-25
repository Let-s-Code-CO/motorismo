/**
 * Staff register and edit customers at the counter (spec 004, HU-06).
 *
 * Guards CA-24 (a customer with a name and a phone only, no email sent), CA-26 (an email already in
 * use is refused), CA-27 (editing; the email of a customer with an account is read-only) and CA-28
 * (a counter customer who later signs up with the same email keeps one record, now with account).
 * Spec 022, CA-10: a customer registered with their first vehicle has it in their record.
 */
import { expect, test } from '@playwright/test';

import {
  SEED,
  SEED_CUSTOMERS,
  adminClient,
  confirmLinkFromEmail,
  deleteCustomers,
  deleteUsersByEmail,
  emailCountFor,
  publicClient,
  signIn,
  uniqueEmail,
  uniquePlate,
} from './support/sandbox';

const later = uniqueEmail('later');
const edited = uniqueEmail('edited');
const withEmail = uniqueEmail('counteremail');
// Tests of this file run in parallel workers: each removes only what it created.
const createdNames: string[] = [];
// Customers with a vehicle: removed with their vehicles.
const createdIds: string[] = [];

test.afterAll(async () => {
  if (createdNames.length)
    await adminClient().from('customers').delete().in('full_name', createdNames);
  await deleteCustomers(createdIds);
  await deleteUsersByEmail([later, edited, withEmail]);
});

const openNewCustomer = async (page: import('@playwright/test').Page) => {
  await page.goto('/customers');
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  return page.getByRole('dialog', { name: /Nuevo cliente/ });
};

test('registers a customer with a name and a phone only (CA-24)', async ({ page }) => {
  const name = `E2E Mostrador ${Date.now()}`;
  createdNames.push(name);
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  const dialog = await openNewCustomer(page);
  await dialog.getByLabel('Nombre completo').fill(name);
  await dialog.getByLabel('Celular (opcional)').fill('312 000 1111');
  await dialog.getByRole('checkbox', { name: /El cliente autorizó/ }).check();
  await dialog.getByRole('button', { name: 'Registrar cliente' }).click();

  await expect(page.getByText('Cliente registrado.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill(name);
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toContainText('Sin correo');
  await expect(row).toContainText('312 000 1111');
  await expect(row).toContainText('Sin cuenta');
});

test('registers a customer with their first vehicle, which their record shows (spec 022, CA-05, CA-10)', async ({
  page,
}) => {
  const name = `E2E Con Moto ${Date.now()}`;
  const plate = uniquePlate('motorcycle');
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  const dialog = await openNewCustomer(page);
  await dialog.getByLabel('Nombre completo').fill(name);
  await dialog.getByLabel('Celular (opcional)').fill('312 000 4444');
  await dialog.getByRole('checkbox', { name: /El cliente autorizó/ }).check();
  await dialog.getByRole('checkbox', { name: 'Registrar también su primer vehículo' }).check();
  const vehicle = dialog.getByRole('group', { name: 'Primer vehículo' });
  await vehicle.getByRole('combobox', { name: 'Marca' }).fill('Suzuki');
  await page.getByRole('option', { name: 'Suzuki', exact: true }).click();
  await vehicle.getByRole('combobox', { name: 'Línea' }).fill('GSX-R600');
  await page.getByRole('option', { name: 'GSX-R600', exact: true }).click();
  await vehicle.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: 'Negro', exact: true }).click();
  await vehicle.getByRole('textbox', { name: 'Placa' }).fill(plate);
  await dialog.getByRole('button', { name: 'Registrar cliente' }).click();

  await expect(page.getByText('Cliente registrado.')).toBeVisible();
  const { data: customer } = await adminClient()
    .from('customers')
    .select('id')
    .eq('full_name', name)
    .single();
  createdIds.push(customer!.id);
  await page.goto(`/customers/${customer!.id}`);
  const vehicles = page.getByRole('region', { name: 'Vehículos' });
  await expect(vehicles.getByText('Suzuki GSX-R600')).toBeVisible();
  await expect(vehicles.locator('[data-plate]')).toContainText(plate.slice(0, 3));
});

test('registering a customer with an email sends them nothing (CA-24)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  const dialog = await openNewCustomer(page);
  await dialog.getByLabel('Nombre completo').fill('E2E Mostrador Con Correo');
  await dialog.getByLabel('Correo (opcional)').fill(withEmail);
  await dialog.getByRole('checkbox', { name: /El cliente autorizó/ }).check();
  await dialog.getByRole('button', { name: 'Registrar cliente' }).click();
  await expect(page.getByText('Cliente registrado.')).toBeVisible();

  // Give any (wrong) email time to arrive: Auth delivers to Mailpit within milliseconds.
  await page.waitForTimeout(1500);
  expect(await emailCountFor(withEmail)).toBe(0);
});

test('refuses an email that already belongs to someone (CA-26)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  const dialog = await openNewCustomer(page);
  await dialog.getByLabel('Nombre completo').fill('E2E Mostrador Duplicado');
  await dialog.getByLabel('Correo (opcional)').fill(SEED_CUSTOMERS.customer.email.toUpperCase());
  await dialog.getByRole('checkbox', { name: /El cliente autorizó/ }).check();
  await dialog.getByRole('button', { name: 'Registrar cliente' }).click();

  await expect(dialog.getByText('Ya existe una cuenta con este correo.')).toBeVisible();
});

test('edits a counter customer, and the email of an account is read-only (CA-27)', async ({
  page,
}) => {
  const { data: admin } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('email', SEED.admin.email)
    .single();
  await adminClient().from('customers').insert({
    full_name: 'E2E Mostrador Editable',
    email: edited,
    phone: '3005550000',
    registered_by: admin!.id,
  });
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto(`/customers?q=${encodeURIComponent(edited)}`);
  await page.getByRole('link', { name: /E2E Mostrador Editable/ }).click();

  await page.getByRole('button', { name: 'Editar datos' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar datos' });
  await dialog.getByLabel('Nombre completo').fill('E2E Mostrador Editado');
  await dialog.getByLabel('Celular (opcional)').fill('3015550000');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole('region', { name: 'Avisos' }).getByText('Datos del cliente guardados.')
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E2E Mostrador Editado' })).toBeVisible();
  await expect(page.getByText('301 555 0000')).toBeVisible();

  await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
  await page.getByRole('button', { name: 'Editar datos' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Editar datos' }).getByLabel('Correo (opcional)')
  ).toHaveAttribute('readonly', '');
  await expect(
    page.getByText('Es el correo con el que entra a su cuenta: no se puede cambiar.')
  ).toBeVisible();
});

test('a counter customer who signs up with the same email keeps one record (CA-28)', async ({
  page,
}) => {
  const { data: admin } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('email', SEED.admin.email)
    .single();
  await adminClient().from('customers').insert({
    full_name: 'E2E Mostrador Luego Registrado',
    email: later,
    registered_by: admin!.id,
  });
  await publicClient().auth.signUp({
    email: later,
    password: 'cliente-nuevo-1',
    options: { data: { full_name: 'Otro Nombre', phone: '3207770000', data_consent: true } },
  });
  await page.goto(await confirmLinkFromEmail(later));
  await expect(page).toHaveURL('/my');
  await page.goto('/profile');
  // The record keeps its data; the phone it lacked comes from the sign-up.
  await expect(page.getByLabel('Nombre completo')).toHaveValue('E2E Mostrador Luego Registrado');
  await expect(page.getByLabel('Celular (opcional)')).toHaveValue('320 777 0000');

  await page.context().clearCookies();
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto(`/customers?q=${encodeURIComponent(later)}`);
  await expect(page.getByRole('grid').getByRole('row')).toHaveCount(2); // header + one customer
  await expect(page.getByRole('row', { name: /E2E Mostrador Luego Registrado/ })).toContainText(
    'Con cuenta'
  );
});
