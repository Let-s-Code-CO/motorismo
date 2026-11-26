/**
 * Work orders at the counter (spec 008, HU-01, HU-02), as an operator, with the local seeds.
 *
 * - CA-01 / CA-02: find a new counter customer, register their motorcycle right from the order;
 *   it comes out chosen.
 * - CA-03 / CA-04: add two services with one tap each, at their reference price; the total is in
 *   sight and changes before saving.
 * - CA-06: share a service between two employees (50/50 by default), changed to 80/20.
 * - CA-07 / CA-32 / CA-33: opening the order shows «Orden #N» in the queue; «Empezar» moves it to
 *   «En proceso».
 * - CA-11: closing with two payment methods adding up to the total.
 * - CA-10: a disabled customer is not offered.
 * - Spec 022 (CA-01, CA-03, CA-04, CA-08): a customer not found is registered from the order, with
 *   their first motorcycle, and the order is opened with both chosen. CA-11: a search by «UIH» shows
 *   the plate each result matched by (seeds: Camila's UIH-03D, Gabriel's UIH-58E; Valentina's KDM-482
 *   of Bogotá and Gabriel's KDM-917 of Medellín); by name, none.
 * - HU-03 / HU-04 / HU-06, on the seed orders of Camila (#2 closed, #3 voided, #4 open with an
 *   «Otro» without time):
 *   - choosing her in «Nueva orden» shows 1 visit and the last one (CA-15);
 *   - her record lists every order (CA-16);
 *   - «Órdenes» shows #4 in progress with a minimum ready time, Andrés's bicycle in the queue
 *     (1.º), and #2 and #3 closed (CA-18, CA-19, CA-30);
 *   - the detail of #4 names what is not estimated, and #2 its payments (CA-20, CA-30).
 */
import { type Locator, type Page, expect, test } from '@playwright/test';

import {
  SEED,
  SEED_CUSTOMERS,
  adminClient,
  createWalkInCustomer,
  deleteCustomers,
  signIn,
  uniquePlate,
} from './support/sandbox';

const created: string[] = [];

/** Removes the orders of the customers this file created, then the customers (with vehicles). */
test.afterAll(async () => {
  if (!created.length) return;
  const admin = adminClient();
  const { data: orders } = await admin.from('work_orders').select('id').in('customer_id', created);
  const orderIds = (orders ?? []).map(({ id }) => id);
  if (orderIds.length) {
    const { data: lines } = await admin
      .from('work_order_lines')
      .select('id')
      .in('work_order_id', orderIds);
    const lineIds = (lines ?? []).map(({ id }) => id);
    if (lineIds.length)
      await admin.from('work_order_line_employees').delete().in('line_id', lineIds);
    await admin.from('work_order_lines').delete().in('work_order_id', orderIds);
    await admin.from('work_order_payments').delete().in('work_order_id', orderIds);
    await admin.from('work_orders').delete().in('id', orderIds);
  }
  await deleteCustomers(created);
});

const pick = async (page: Page, dialog: Locator, field: string, typed: string) => {
  await dialog.getByRole('combobox', { name: field }).fill(typed);
  await page.getByRole('option', { name: typed, exact: true }).click();
};

test('an operator opens an order for a new customer, registering the motorcycle there, and closes it with two payments (CA-01 to CA-07, CA-11)', async ({
  page,
}) => {
  const name = `E2E Orden ${Date.now()}`;
  created.push(await createWalkInCustomer(name));
  const plate = uniquePlate('motorcycle');
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  // CA-01: find the customer.
  await page.goto('/orders/new');
  await page.getByLabel('Buscar cliente').fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByText('Este cliente no tiene vehículos activos.')).toBeVisible();

  // CA-02: register the motorcycle from the order; it comes out chosen.
  await page.getByRole('button', { name: 'Registrar vehículo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Registrar vehículo' });
  await pick(page, dialog, 'Marca', 'Suzuki');
  await pick(page, dialog, 'Línea', 'GSX-R600');
  await dialog.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: 'Negro', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Placa' }).fill(plate);
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('radio', { name: /Suzuki GSX-R600/ })).toBeChecked();

  // CA-03, CA-04: two services, one tap each, at their motorcycle price.
  await page.getByRole('button', { name: 'Añadir Lavado sencillo' }).click();
  await page.getByRole('button', { name: 'Añadir Micropulido' }).click();
  const summary = page.getByRole('region', { name: 'Resumen de la orden' });
  // 25.000 + 120.000 = 145.000.
  await expect(summary).toContainText('$ 145.000');

  // CA-06: Micropulido shared by two employees, 80/20.
  const micropulido = page.getByRole('group', { name: 'Micropulido' });
  await micropulido.getByRole('button', { name: 'Elkin Estrada' }).click();
  await micropulido.getByRole('button', { name: 'Paula Pineda' }).click();
  await expect(micropulido.getByLabel('Participación de Elkin Estrada')).toHaveValue('50');
  await micropulido.getByLabel('Participación de Elkin Estrada').fill('80');
  await micropulido.getByLabel('Participación de Paula Pineda').fill('20');
  await page
    .getByRole('group', { name: 'Lavado sencillo' })
    .getByRole('button', { name: 'Paula Pineda' })
    .click();

  // CA-07: open it.
  await page.getByRole('button', { name: 'Abrir orden' }).click();
  await expect(page.getByText('Orden abierta.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Orden #\d+$/ })).toBeVisible();
  await expect(page.getByText('En cola', { exact: true })).toBeVisible();
  // CA-33: start it.
  await page.getByRole('button', { name: 'Empezar' }).click();
  await expect(page.getByText('Orden en proceso.')).toBeVisible();
  await expect(page.getByText('En proceso', { exact: true })).toBeVisible();
  await expect(page.getByText(/Empezada el .* por Óscar Operador/)).toBeVisible();
  await expect(page.getByText('Elkin Estrada (80 %) · Paula Pineda (20 %)')).toBeVisible();

  // CA-11: close it, half cash half transfer.
  await page.getByRole('button', { name: 'Cerrar y cobrar' }).click();
  const close = page.getByRole('dialog', { name: /Cerrar y cobrar la orden/ });
  await close.getByLabel('Monto').fill('100.000');
  await expect(close.getByText('Falta $ 45.000')).toBeVisible();
  await close.getByRole('button', { name: 'Añadir otro medio' }).click();
  await expect(close.getByLabel('Monto').nth(1)).toHaveValue('45.000');
  await close.getByRole('button', { name: 'Cerrar orden' }).click();

  await expect(page.getByText('Orden cerrada.')).toBeVisible();
  await expect(page.getByText('Cerrada', { exact: true })).toBeVisible();
  await expect(page.getByText('Transferencia')).toBeVisible();
});

test('an operator registers the customer they did not find, with their motorcycle, without leaving the order (spec 022, CA-01, CA-03, CA-04, CA-08)', async ({
  page,
}) => {
  const name = `E2E Nuevo ${Date.now()}`;
  const plate = uniquePlate('motorcycle');
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  // CA-01: nobody found; «Registrar cliente» is there.
  await page.goto('/orders/new');
  await page.getByLabel('Buscar cliente').fill(name);
  await expect(page.getByText('No se encontró ningún cliente activo.')).toBeVisible();
  await page.getByRole('button', { name: 'Registrar cliente' }).click();

  // CA-04: what was searched is the name; the first motorcycle, in the same form.
  const dialog = page.getByRole('dialog', { name: 'Registrar cliente sin cuenta' });
  await expect(dialog.getByLabel('Nombre completo')).toHaveValue(name);
  await dialog.getByLabel('Celular (opcional)').fill('312 000 3333');
  await dialog.getByRole('checkbox', { name: /El cliente autorizó/ }).check();
  await dialog.getByRole('checkbox', { name: 'Registrar también su primer vehículo' }).check();
  const vehicle = dialog.getByRole('group', { name: 'Primer vehículo' });
  await pick(page, vehicle, 'Marca', 'Suzuki');
  await pick(page, vehicle, 'Línea', 'GSX-R600');
  await vehicle.getByRole('button', { name: /Color/ }).click();
  await page.getByRole('option', { name: 'Negro', exact: true }).click();
  await vehicle.getByRole('textbox', { name: 'Placa' }).fill(plate);
  await dialog.getByRole('button', { name: 'Registrar cliente' }).click();

  // CA-03, CA-08: back in the order, with the customer and the motorcycle chosen.
  await expect(dialog).toBeHidden();
  const { data: customer } = await adminClient()
    .from('customers')
    .select('id')
    .eq('full_name', name)
    .single();
  created.push(customer!.id);
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByRole('radio', { name: /Suzuki GSX-R600/ })).toBeChecked();

  await page.getByRole('button', { name: 'Añadir Lavado sencillo' }).click();
  await page.getByRole('button', { name: 'Abrir orden' }).click();
  await expect(page.getByText('Orden abierta.')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Orden #\d+$/ })).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
});

test('the search shows the plate a customer matched by, only when it matched by plate (spec 022, CA-11)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/orders/new');

  await page.getByLabel('Buscar cliente').fill('uih');
  const camila = page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.customer.name) });
  const gabriel = page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.google.name) });
  await expect(camila.locator('[data-plate]')).toHaveText('UIH-03D');
  await expect(camila.locator('[data-plate]')).toHaveAttribute('data-legend', 'COLOMBIA');
  await expect(gabriel.locator('[data-plate]')).toHaveText('UIH-58E');
  await expect(gabriel.locator('[data-plate]')).toHaveAttribute('data-legend', 'COLOMBIA');

  // Car plates with the city that issued them: Valentina's in Bogotá, Gabriel's in Medellín.
  await page.getByLabel('Buscar cliente').fill('kdm');
  const valentina = page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) });
  // Spec 023, RN-05: drawn in capitals without accents.
  await expect(valentina.locator('[data-plate]')).toHaveAttribute('data-legend', 'BOGOTA, D.C.');
  await expect(gabriel.locator('[data-plate]')).toHaveAttribute('data-legend', 'MEDELLIN');

  await page.getByLabel('Buscar cliente').fill(SEED_CUSTOMERS.customer.name);
  await expect(camila).toBeVisible();
  await expect(camila.locator('[data-plate]')).toHaveCount(0);
});

test('a disabled customer is not offered for a new order (CA-10)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/orders/new');

  await page.getByLabel('Buscar cliente').fill(SEED_CUSTOMERS.disabled.name);

  await expect(page.getByText('No se encontró ningún cliente activo.')).toBeVisible();
});

test("staff see a customer's history (her retired vehicle not offered), what is in the car wash and the closed orders (CA-10, CA-15, CA-16, CA-18 to CA-20, CA-30)", async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  // CA-15: choosing Camila shows her visits and the last one (#3 voided and #4 open do not count).
  await page.goto('/orders/new');
  await page.getByLabel('Buscar cliente').fill(SEED_CUSTOMERS.customer.name);
  await page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
  await expect(page.getByText('1 visita')).toBeVisible();
  await expect(page.getByText('Lavado sencillo · Micropulido')).toBeVisible();
  // Her motorcycle already has the open order #4: it is offered instead.
  await expect(page.getByText('Ya tiene una orden abierta:')).toBeVisible();
  // CA-10: her retired motorcycle (JWJ-07) is not offered for an order.
  await expect(page.getByText(/JWJ-07/)).toHaveCount(0);

  // CA-18, CA-30: in progress with a minimum ready time; the queue by arrival, with its turn.
  await page.goto('/orders');
  const inProgress = page.getByRole('list', { name: 'Órdenes en proceso' });
  const camilaOpen = inProgress
    .getByRole('listitem')
    .filter({ hasText: SEED_CUSTOMERS.customer.name });
  await expect(camilaOpen).toContainText('Lista desde las');
  const queue = page.getByRole('list', { name: 'Órdenes en cola' });
  // Its turn by arrival (spec 012's seeded reservation of this hour may go before it).
  await expect(
    queue.getByRole('listitem').filter({ hasText: SEED_CUSTOMERS.phoneOnly.name })
  ).toContainText(/\d\.º/);
  // The whole card opens the order, also where there is no text (its turn).
  const andres = queue.getByRole('listitem').filter({ hasText: SEED_CUSTOMERS.phoneOnly.name });
  // A point of the card with no text (by its turn): the stretched link receives the click.
  await andres.click({ position: { x: 24, y: 60 } });
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
  await expect(page.getByText(SEED_CUSTOMERS.phoneOnly.name).first()).toBeVisible();
  await page.goto('/orders');
  // CA-19: closed and voided, newest first.
  const closed = page.getByRole('list', { name: 'Órdenes cerradas' });
  await expect(closed.getByRole('listitem').filter({ hasText: 'Anulada' }).first()).toBeVisible();

  // CA-20, CA-30: the open order names what is not estimated.
  await camilaOpen.getByRole('link').click();
  await expect(page.getByText('Falta estimar: Limpieza de cadena')).toBeVisible();
  await expect(page.getByText('Trae un rayón en el tanque')).toBeVisible();

  // CA-16: her record lists every order, with its status.
  await page.getByRole('link', { name: SEED_CUSTOMERS.customer.name }).click();
  const history = page
    .getByRole('heading', { name: 'Órdenes', level: 2 })
    .locator('..')
    .locator('..');
  await expect(history).toContainText('En proceso');
  await expect(history).toContainText('Anulada');
  await expect(history).toContainText('Cerrada');
});
