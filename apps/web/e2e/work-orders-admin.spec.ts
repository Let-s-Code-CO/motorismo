/**
 * Voiding and correcting work orders (spec 008, HU-05), with orders prepared through the API as an
 * operator would leave them.
 *
 * - CA-21: an operator voids an open order with a reason; it says by whom and why.
 * - RN-05: on a closed order, an operator sees neither «Corregir» nor the «Anulación» section.
 * - CA-22: an admin corrects a closed order (a price, the payments) with a reason; it says by whom
 *   and why, with the new total.
 * - CA-23: an admin voids a closed order; it stops counting as a visit of the customer.
 */
import { type Page, expect, test } from '@playwright/test';

import {
  SEED,
  adminClient,
  createWalkInCustomer,
  deleteCustomers,
  publicClient,
  signIn,
  uniquePlate,
} from './support/sandbox';

test.describe.configure({ mode: 'serial' });

const name = `E2E Anular ${Date.now()}`;
let customerId: string;
let openOrder: string;
let closedOrder: string;

/** An operator's own session, to prepare orders through the same functions the app uses. */
const operatorClient = async () => {
  const client = publicClient();
  await client.auth.signInWithPassword({ email: SEED.operator.email, password: SEED.password });
  return client;
};

test.beforeAll(async () => {
  customerId = await createWalkInCustomer(name);
  const operator = await operatorClient();
  const admin = adminClient();
  const { data: vehicleId } = await operator.rpc('save_vehicle', {
    p_customer_id: customerId,
    p_vehicle_type: 'motorcycle',
    p_brand_name: 'Suzuki',
    p_line_name: 'GSX-R600',
    p_color: 'black',
    p_plate: uniquePlate('motorcycle'),
  });
  const { data: service } = await admin
    .from('services')
    .select('id')
    .eq('name', 'Limpieza de asientos')
    .single();
  const { data: elkin } = await admin
    .from('employees')
    .select('id')
    .eq('full_name', 'Elkin Estrada')
    .single();
  const line = {
    service_id: service!.id,
    employees: [{ employee_id: elkin!.id, share_pct: 100 }],
  };

  // A closed order (Limpieza de asientos, $ 16.000 in cash), then an open one for the same motorcycle.
  const closed = await operator.rpc('save_work_order', {
    p_customer_id: customerId,
    p_vehicle_id: vehicleId!,
    p_lines: [line],
  });
  closedOrder = closed.data!;
  await operator.rpc('close_work_order', {
    p_id: closedOrder,
    p_payments: [{ method: 'cash', amount: 16000 }],
  });
  const open = await operator.rpc('save_work_order', {
    p_customer_id: customerId,
    p_vehicle_id: vehicleId!,
    p_lines: [line],
  });
  openOrder = open.data!;
});

test.afterAll(async () => {
  const admin = adminClient();
  const ids = [openOrder, closedOrder].filter(Boolean);
  const { data: lines } = await admin
    .from('work_order_lines')
    .select('id')
    .in('work_order_id', ids);
  await admin
    .from('work_order_line_employees')
    .delete()
    .in(
      'line_id',
      (lines ?? []).map(({ id }) => id)
    );
  await admin.from('work_order_lines').delete().in('work_order_id', ids);
  await admin.from('work_order_payments').delete().in('work_order_id', ids);
  await admin.from('work_orders').delete().in('id', ids);
  await deleteCustomers([customerId]);
});

const openAs = async (page: Page, email: string, orderId: string) => {
  await signIn(page, email);
  await expect(page).toHaveURL('/');
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByRole('heading', { name: /^Orden #\d+$/ })).toBeVisible();
};

test('an operator voids an open order with a reason, and cannot touch a closed one (CA-21, RN-05)', async ({
  page,
}) => {
  await openAs(page, SEED.operator.email, openOrder);

  await page
    .getByRole('region', { name: 'Anulación' })
    .getByRole('button', { name: 'Anular orden' })
    .click();
  const dialog = page.getByRole('dialog', { name: /Anular la orden/ });
  await dialog.getByLabel('Motivo').fill('El cliente se fue sin el servicio');
  await dialog.getByRole('button', { name: 'Anular orden' }).click();

  await expect(page.getByText('Orden anulada.')).toBeVisible();
  await expect(
    page.getByText(/Anulada el .* por Óscar Operador: El cliente se fue sin el servicio/)
  ).toBeVisible();

  await page.goto(`/orders/${closedOrder}`);
  await expect(page.getByRole('heading', { name: /^Orden #\d+$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Corregir' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Anulación' })).toHaveCount(0);
});

test('an admin corrects a closed order with a reason, then voids it; it stops counting as a visit (CA-22, CA-23)', async ({
  page,
}) => {
  await openAs(page, SEED.admin.email, closedOrder);

  // CA-22: correct the price; the payments follow the new total.
  await page.getByRole('button', { name: 'Corregir' }).click();
  await page
    .getByRole('group', { name: 'Limpieza de asientos' })
    .getByLabel('Valor')
    .fill('20.000');
  await page.getByRole('button', { name: 'Continuar: pagos y motivo' }).click();
  const dialog = page.getByRole('dialog', { name: /Corregir la orden/ });
  await expect(dialog.getByLabel('Monto')).toHaveValue('20.000');
  await dialog.getByLabel('Motivo de la corrección').fill('Se cobró de más');
  await dialog.getByRole('button', { name: 'Guardar corrección' }).click();

  await expect(page.getByText('Orden corregida.')).toBeVisible();
  await expect(
    page.getByText(/Corregida el .* por Sebastián Pulido: Se cobró de más/)
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resumen de la orden' })).toContainText(
    'Total$ 20.000'
  );

  // CA-23: void it; it stops counting as a visit.
  await page
    .getByRole('region', { name: 'Anulación' })
    .getByRole('button', { name: 'Anular orden' })
    .click();
  const voidDialog = page.getByRole('dialog', { name: /Anular la orden/ });
  await voidDialog.getByLabel('Motivo').fill('Orden duplicada');
  await voidDialog.getByRole('button', { name: 'Anular orden' }).click();
  await expect(page.getByText('Orden anulada.')).toBeVisible();

  await page.goto('/orders/new');
  await page.getByLabel('Buscar cliente').fill(name);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByText('Primera visita: aún no tiene órdenes cerradas.')).toBeVisible();
});
