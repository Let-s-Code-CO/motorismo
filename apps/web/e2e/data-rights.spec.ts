/**
 * The rights of the data subject (spec 017), in a real browser against the local database. Each
 * test has its own customers (created with the secret key) and removes them at the end.
 *
 * - CA-01 / CA-02: from «Mi perfil», «Mis datos» shows their profile and vehicle and downloads the
 *   file.
 * - CA-04 / CA-07 / CA-11: they ask for a correction; the admin attends it with an answer, and they
 *   see it «Atendida».
 * - CA-05 / CA-09 / CA-10 / CA-12: they ask for the erasure; the admin sees it in «Solicitudes de
 *   datos» and on the home tile, erases, and the customer is out on their next step; their record
 *   says «Cliente suprimido».
 * - CA-16 / CA-17: the admin registers an inquiry of a customer without account and downloads their
 *   data.
 * - CA-15: an operator is told they have no permission, and the download answers 403.
 */
import { type Browser, type Page, expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

import {
  SEED,
  adminClient,
  createCustomerAccount,
  createWalkInCustomer,
  signIn,
  uniqueEmail,
  uniquePlate,
} from './support/sandbox';
import { toast } from './support/toasts';

const customers: string[] = [];

test.afterAll(async () => {
  const admin = adminClient();
  await admin.from('data_requests').delete().in('customer_id', customers);
  await admin.from('vehicles').delete().in('customer_id', customers);
  await admin.from('customers').delete().in('id', customers);
});

/** A customer with an account and a motorcycle of their own. */
const newCustomer = async (label: string) => {
  const email = uniqueEmail(label);
  const userId = await createCustomerAccount({
    email,
    fullName: `E2E ${label}`,
    phone: '3001112233',
  });
  const { data: customer } = await adminClient()
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .single();
  customers.push(customer!.id);
  const plate = uniquePlate('motorcycle');
  await adminClient().rpc('save_vehicle', {
    p_customer_id: customer!.id,
    p_vehicle_type: 'motorcycle',
    p_brand_name: 'Suzuki',
    p_line_name: 'GSX-R600',
    p_color: 'black',
    p_plate: plate,
  });
  return { email, name: `E2E ${label}`, id: customer!.id, plate };
};

const asAdmin = async (browser: Browser) => {
  const page = await (
    await browser.newContext({ viewport: { width: 1280, height: 900 } })
  ).newPage();
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  return page;
};

/** Opens the admin's detail of this customer's request of this kind. */
const openRequest = async (admin: Page, name: string, kind: string) => {
  await admin.goto('/admin/data-requests');
  await admin
    .getByRole('list', { name: 'Solicitudes pendientes' })
    .getByRole('link', { name: new RegExp(`${kind} · ${name}`) })
    .click();
  await expect(admin.getByRole('heading', { name: `${kind} · ${name}`, level: 1 })).toBeVisible();
};

test.use({ viewport: { width: 1280, height: 900 } });

test('a customer sees and downloads their data, and the admin attends their correction (CA-01, CA-02, CA-04, CA-07, CA-11)', async ({
  page,
  browser,
}) => {
  const customer = await newCustomer('datos');
  await signIn(page, customer.email);
  await expect(page).toHaveURL('/my');

  await page.goto('/profile');
  await page.getByRole('link', { name: /Mis datos/ }).click();
  await expect(page).toHaveURL('/my/data');
  const profile = page.getByRole('region', { name: 'Tus datos personales' });
  await expect(profile).toContainText(customer.name);
  await expect(profile).toContainText(customer.email);
  await expect(page.getByRole('region', { name: 'Tus vehículos' })).toContainText(
    `${customer.plate.slice(0, 3)}-${customer.plate.slice(3)}`
  );

  // CA-02: the file.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Descargar mis datos' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^mis-datos-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(file.profile.email).toBe(customer.email);
  expect(file.vehicles[0].plate).toBe(customer.plate);

  // CA-04: a correction.
  await page.getByRole('button', { name: 'Pedir una corrección' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pedir una corrección' });
  await dialog.getByLabel('¿Qué hay que corregir?').fill('Mi correo ahora es otro');
  await dialog.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(toast(page, 'Solicitud enviada.')).toBeVisible();
  const requests = page.getByRole('region', { name: 'Tus solicitudes' });
  await expect(requests).toContainText('Recibida');
  await expect(requests).toContainText('Te responderemos a más tardar el');

  // CA-11: the admin attends it with an answer.
  const admin = await asAdmin(browser);
  await openRequest(admin, customer.name, 'Corrección');
  await admin.getByLabel('Respuesta o motivo para el cliente').fill('Actualizamos tu correo.');
  await admin.getByRole('button', { name: 'Marcar atendida' }).click();
  await expect(toast(admin, 'Solicitud atendida.')).toBeVisible();

  // CA-07: the customer sees it attended, with the answer.
  await page.reload();
  await expect(requests).toContainText('Atendida');
  await expect(requests).toContainText('Respuesta: Actualizamos tu correo.');
});

test('the admin erases a customer who asked for it, and they are out on their next step (CA-05, CA-09, CA-10, CA-12)', async ({
  page,
  browser,
}) => {
  const customer = await newCustomer('suprimir');
  await signIn(page, customer.email);
  await expect(page).toHaveURL('/my');
  await page.goto('/my/data');

  await page.getByRole('button', { name: 'Pedir la supresión de mis datos' }).click();
  const dialog = page.getByRole('dialog', { name: '¿Pedir la supresión de tus datos?' });
  await expect(dialog).toContainText('se cerrará tu cuenta');
  await dialog.getByRole('button', { name: 'Pedir la supresión' }).click();
  await expect(toast(page, 'Solicitud enviada.')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Pedir la supresión de mis datos' })
  ).toBeDisabled();

  // CA-10: the admin's home counts it.
  const admin = await asAdmin(browser);
  await expect(
    admin
      .getByRole('list', { name: 'Secciones' })
      .getByRole('link', { name: /Solicitudes de datos/ })
  ).toContainText(/\d+ pendientes?/);

  // CA-09 / CA-12: from the list, erase.
  await openRequest(admin, customer.name, 'Supresión');
  await admin.getByRole('button', { name: 'Suprimir datos' }).click();
  await admin
    .getByRole('dialog', { name: `¿Suprimir los datos de ${customer.name}?` })
    .getByRole('button', { name: 'Suprimir datos' })
    .click();
  await expect(toast(admin, 'Datos suprimidos.')).toBeVisible();
  await admin.goto(`/customers/${customer.id}`);
  await expect(admin.getByRole('heading', { name: 'Cliente suprimido' })).toBeVisible();

  // The customer, on their next step, is out.
  await page.goto('/my');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('the admin registers an inquiry of a customer without account and downloads their data (CA-16, CA-17)', async ({
  browser,
}) => {
  const name = `E2E Ventanilla ${Date.now()}`;
  const id = await createWalkInCustomer(name);
  customers.push(id);
  const admin = await asAdmin(browser);

  await admin.goto(`/customers/${id}`);
  await admin.getByRole('button', { name: 'Registrar solicitud de datos' }).click();
  const dialog = admin.getByRole('dialog', { name: 'Registrar una solicitud de datos' });
  await expect(dialog).toContainText('Plazo: 10 días hábiles.');
  await dialog.getByLabel('Lo que pidió').fill('Quiere saber qué datos suyos guardamos');
  await dialog.getByRole('button', { name: 'Registrar' }).click();
  await expect(toast(admin, 'Solicitud registrada.')).toBeVisible();

  await openRequest(admin, name, 'Consulta');
  await expect(admin.getByText('Punto de atención')).toBeVisible();
  const [download] = await Promise.all([
    admin.waitForEvent('download'),
    admin.getByRole('link', { name: 'Descargar sus datos' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^datos-cliente-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(file.profile.full_name).toBe(name);
});

test('an operator has no data requests and no customer data file (CA-15)', async ({ page }) => {
  const id = await createWalkInCustomer(`E2E Sin permiso ${Date.now()}`);
  customers.push(id);
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await expect(page.getByRole('link', { name: 'Habeas data' })).toHaveCount(0);
  await page.goto('/admin/data-requests');
  await expect(page.getByText('No tienes permiso para ver esta página.')).toBeVisible();

  const response = await page.request.get(`/customers/${id}/data/export`);
  expect(response.status()).toBe(403);
});
