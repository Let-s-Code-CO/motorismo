/**
 * "Mis vehículos": a customer keeps their own vehicles from "Mi perfil" (spec 005, HU-06).
 *
 * Guards CA-23 (the section, empty at first, with the same form), CA-24 (the customer adds,
 * corrects and retires; a retired vehicle disappears for them and staff see every change on the
 * record) and CA-25 (a plate of another customer is refused with the customer's message, without
 * saying whose it is). A fresh customer account per run (Camila's data stays as seeded).
 */
import { type Locator, type Page, expect, test } from '@playwright/test';

import {
  SEED,
  adminClient,
  createCustomerAccount,
  deleteUsersByEmail,
  shownPlate,
  signIn,
  uniqueEmail,
  uniquePlate,
} from './support/sandbox';

const email = uniqueEmail('myvehicles');
const name = `E2E Mis Vehículos ${Date.now()}`;

test.beforeAll(async () => {
  await createCustomerAccount({ email, fullName: name });
});

test.afterAll(async () => {
  await deleteUsersByEmail([email]);
});

const fillMotorcycle = async (page: Page, dialog: Locator, plate: string, color: string) => {
  await dialog.getByRole('combobox', { name: 'Marca' }).fill('yamaha');
  await page.getByRole('option', { name: 'Yamaha', exact: true }).click();
  await dialog.getByRole('combobox', { name: 'Línea' }).fill('nmax');
  await page.getByRole('option', { name: 'NMAX 155', exact: true }).click();
  await dialog.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: color, exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(plate);
};

test('a customer adds, corrects and retires their vehicles; staff see it (CA-23, CA-24, CA-25)', async ({
  page,
}) => {
  const plate = uniquePlate('motorcycle');
  await signIn(page, email);
  await expect(page).toHaveURL('/profile');

  const mine = page.getByRole('region', { name: 'Mis vehículos' });
  await expect(mine.getByText('Aún no tienes vehículos.')).toBeVisible();

  // A plate of another customer (Camila's UIH-03D) is refused with the customer's message (CA-25).
  await mine.getByRole('button', { name: 'Agregar vehículo' }).click();
  let dialog = page.getByRole('dialog', { name: 'Agregar vehículo' });
  await fillMotorcycle(page, dialog, 'UIH03D', 'Blanco');
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(
    dialog.getByText(
      'Ya hay un vehículo registrado con esta placa. Si es tuyo, acércate al punto de atención.'
    )
  ).toBeVisible();

  // With their own plate it is saved (CA-24).
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(plate);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(mine.getByRole('list', { name: 'Mis vehículos' })).toContainText('Yamaha NMAX 155');

  // Corrected.
  await mine.getByRole('button', { name: 'Editar Yamaha NMAX 155' }).click();
  dialog = page.getByRole('dialog', { name: 'Editar vehículo' });
  await dialog.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: 'Gris', exact: true }).click();
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(mine.getByRole('list', { name: 'Mis vehículos' })).toContainText('Gris');

  // Staff see it on the customer record.
  const staff = await page.context().browser()!.newContext();
  const staffPage = await staff.newPage();
  await signIn(staffPage, SEED.operator.email);
  await expect(staffPage).toHaveURL('/');
  const { data: customer } = await adminClient()
    .from('customers')
    .select('id')
    .eq('email', email)
    .single();
  await staffPage.goto(`/customers/${customer!.id}`);
  await expect(staffPage.getByRole('heading', { name })).toBeVisible();
  const record = staffPage.getByRole('region', { name: 'Vehículos' });
  await expect(record).toContainText('Yamaha NMAX 155');
  await expect(record).toContainText(shownPlate(plate));

  // Retired by the customer: they no longer see it; staff find it among the retired.
  await mine.getByRole('button', { name: 'Retirar Yamaha NMAX 155' }).click();
  await page
    .getByRole('dialog', { name: 'Retirar vehículo' })
    .getByRole('button', { name: 'Retirar' })
    .click();
  await expect(mine.getByText('Aún no tienes vehículos.')).toBeVisible();
  await expect(mine.getByText(/Vehículos retirados/)).toHaveCount(0);

  await staffPage.reload();
  await expect(record.getByText('Este cliente aún no tiene vehículos.')).toBeVisible();
  await record.getByRole('button', { name: 'Vehículos retirados (1)' }).click();
  await expect(record.getByRole('list', { name: 'Vehículos retirados (1)' })).toContainText(
    'Yamaha NMAX 155'
  );
  await staff.close();
});
