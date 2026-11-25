/**
 * What a customer with an account sees and does (spec 014), in a real browser against the local
 * database. Each test has its own customer, except the history, which reads Camila's seeds.
 *
 * - CA-01 / CA-05: their vehicle in the queue, «Van N antes»; staff start it and «Inicio» turns to
 *   «En proceso» without reloading.
 * - CA-07 / CA-08: the history with the detail of a closed order, never the voided one.
 * - CA-12 / CA-16: they book from the app; staff see «Reservó el cliente desde la app».
 * - CA-22: staff give «+5 min» and «Mis reservas» shows the new time without reloading.
 * - CA-19: they cancel with a reason; staff see «Cancelada por el cliente» and the reason.
 * - Spec 021: the same vehicle booked for two days, not twice the same day (CA-01, CA-02, CA-05),
 *   with the estimated time of the services ticked (CA-06, CA-07).
 */
import { type Page, expect, test } from '@playwright/test';

import {
  SEED,
  SEED_CUSTOMERS,
  adminClient,
  createCustomerAccount,
  deleteUsersByEmail,
  publicClient,
  signIn,
  uniqueEmail,
  uniquePlate,
} from './support/sandbox';

const emails: string[] = [];

/** A customer with an account of their own, and optionally a motorcycle. */
const newCustomer = async (label: string, withMotorcycle = false) => {
  const email = uniqueEmail(label);
  emails.push(email);
  await createCustomerAccount({ email, fullName: `E2E ${label}` });
  const { data: customer } = await adminClient()
    .from('customers')
    .select('id')
    .eq('email', email)
    .single();
  let vehicleId: string | null = null;
  if (withMotorcycle) {
    const operator = await staff();
    const { data } = await operator.rpc('save_vehicle', {
      p_customer_id: customer!.id,
      p_vehicle_type: 'motorcycle',
      p_brand_name: 'Suzuki',
      p_line_name: 'GSX-R600',
      p_color: 'black',
      p_plate: uniquePlate('motorcycle'),
    });
    vehicleId = data;
  }
  return { email, customerId: customer!.id, vehicleId };
};

/** The operator's own session, to act as staff through the API. */
const staff = async () => {
  const operator = publicClient();
  await operator.auth.signInWithPassword({ email: SEED.operator.email, password: SEED.password });
  return operator;
};

test.afterAll(async () => {
  const admin = adminClient();
  const { data: customers } = await admin.from('customers').select('id').in('email', emails);
  const ids = (customers ?? []).map(({ id }) => id);
  const { data: reservations } = await admin
    .from('reservations')
    .select('id')
    .in('customer_id', ids);
  const reservationIds = (reservations ?? []).map(({ id }) => id);
  await admin.from('reservation_extensions').delete().in('reservation_id', reservationIds);
  await admin.from('reservation_services').delete().in('reservation_id', reservationIds);
  await admin.from('reservations').delete().in('id', reservationIds);
  const { data: orders } = await admin.from('work_orders').select('id').in('customer_id', ids);
  const orderIds = (orders ?? []).map(({ id }) => id);
  await admin.from('work_order_lines').delete().in('work_order_id', orderIds);
  await admin.from('work_orders').delete().in('id', orderIds);
  await deleteUsersByEmail(emails);
});

const shop = (page: Page) => page.getByRole('region', { name: 'En el lavadero' });

test.describe('the customer area (spec 014)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('their motorcycle waits in the queue and turns «En proceso» without reloading (CA-01, CA-05)', async ({
    page,
  }) => {
    const { email, customerId, vehicleId } = await newCustomer('enlavadero', true);
    const operator = await staff();
    const { data: service } = await adminClient()
      .from('services')
      .select('id')
      .eq('name', 'Lavado sencillo')
      .single();
    const { data: orderId } = await operator.rpc('save_work_order', {
      p_customer_id: customerId,
      p_vehicle_id: vehicleId!,
      p_lines: [{ service_id: service!.id }],
    });

    await signIn(page, email);
    await expect(page).toHaveURL('/my');
    await expect(shop(page).getByText('En cola')).toBeVisible();
    await expect(
      shop(page).getByText(/^(Van \d+ antes|Va 1 antes|Eres el siguiente)$/)
    ).toBeVisible();
    await expect(shop(page).getByText('Lavado sencillo')).toBeVisible();

    await operator.rpc('start_work_order', { p_id: orderId! });
    // Refreshed every 15 s while on screen: no reload.
    await expect(shop(page).getByText('En proceso')).toBeVisible({ timeout: 20_000 });
    await expect(shop(page).getByText(/^(Lista hacia las .+|Sin hora estimada)$/)).toBeVisible();
  });

  test('the history shows a closed order in detail and never a voided one (CA-07, CA-08)', async ({
    page,
  }) => {
    await signIn(page, SEED_CUSTOMERS.customer.email);
    await expect(page).toHaveURL('/my');
    await page.goto('/my/history');

    const order = page.getByRole('article', { name: 'Orden #2' });
    await expect(order.getByText('Descuento')).toBeVisible();
    await expect(order.getByText('Total', { exact: true })).toBeVisible();
    await expect(page.getByRole('article', { name: 'Orden #3' })).toHaveCount(0);
  });

  test('they book from the app, get more time from staff without reloading, and cancel (CA-12, CA-16, CA-22, CA-19)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    const { email, customerId } = await newCustomer('reserva');
    await signIn(page, email);
    await expect(page).toHaveURL('/my');

    await page.getByRole('button', { name: 'Reservar' }).first().click();
    await expect(page).toHaveURL(/\/my\/reservations\/new/);
    await page.getByRole('radio', { name: 'Sin vehículo' }).check({ force: true });
    // Tomorrow, 3:00 p. m.: the seeds leave it free.
    const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
      new Date(Date.now() + 24 * 60 * 60 * 1000)
    );
    await page.goto(`/my/reservations/new?date=${tomorrow}`);
    await page.getByRole('radio', { name: 'Sin vehículo' }).check({ force: true });
    await page.getByRole('radio', { name: /^3:00 p\. m\./ }).check({ force: true });
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();

    await expect(page).toHaveURL('/my/reservations');
    await expect(
      page.getByRole('region', { name: 'Avisos' }).getByText('Reserva guardada.')
    ).toBeVisible();
    const pending = page.getByRole('list', { name: 'Próximas' });
    await expect(pending.getByText(/hasta las 3:15 p\. m\./)).toBeVisible();

    // Staff see it, made by the customer (CA-16).
    const { data: reservation } = await adminClient()
      .from('reservations')
      .select('id')
      .eq('customer_id', customerId)
      .single();
    const staffPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await signIn(staffPage, SEED.operator.email);
    await expect(staffPage).toHaveURL('/');
    await staffPage.goto(`/agenda/${reservation!.id}`);
    await expect(staffPage.getByText(/^Reservó el cliente desde la app el /)).toBeVisible();

    // Staff give 5 more minutes; «Mis reservas» shows it without reloading (CA-22).
    const operator = await staff();
    await operator.rpc('extend_reservation_tolerance', { p_id: reservation!.id });
    await expect(pending.getByText(/hasta las 3:20 p\. m\./)).toBeVisible({ timeout: 20_000 });

    // They cancel, with a reason (CA-19).
    await pending.getByRole('button', { name: /^Cancelar reserva del/ }).click();
    const dialog = page.getByRole('dialog', { name: '¿Cancelar tu reserva?' });
    await dialog.getByLabel('Motivo (opcional)').fill('Me salió un viaje');
    await dialog.getByRole('button', { name: 'Cancelar reserva' }).click();
    await expect(
      page.getByRole('region', { name: 'Avisos' }).getByText('Reserva cancelada.')
    ).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Anteriores' }).getByText('La cancelaste tú')
    ).toBeVisible();

    await staffPage.reload();
    await expect(staffPage.getByText(/^Cancelada por el cliente el /)).toBeVisible();
    await expect(staffPage.getByText('Motivo: Me salió un viaje')).toBeVisible();
    await staffPage.close();
  });

  test('they book the same vehicle for two days, not twice the same day, seeing the time of what they choose (spec 021, CA-01, CA-02, CA-05, CA-06, CA-07)', async ({
    page,
  }) => {
    const { email, customerId } = await newCustomer('varias', true);
    await signIn(page, email);
    await expect(page).toHaveURL('/my');
    const day = (days: number) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
        new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      );
    const estimate = page.locator('[data-booking-estimate]');
    const book = async (date: string, hour: RegExp) => {
      await page.goto(`/my/reservations/new?date=${date}`);
      // Their only vehicle comes chosen (spec 008, RN-10).
      await page.getByRole('radio', { name: hour }).check({ force: true });
      await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    };

    // Tomorrow at 4:00 p. m., with the time of the services ticked (CA-06, CA-07).
    await page.goto(`/my/reservations/new?date=${day(1)}`);
    await page.getByRole('radio', { name: /^4:00 p\. m\./ }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Lavado sencillo' }).check({ force: true });
    // 30 + 90 min.
    await page.getByRole('checkbox', { name: 'Lavado detallado' }).check({ force: true });
    await expect(estimate).toHaveText('Tiempo estimado: ≈ 2 h');
    await page.getByRole('checkbox', { name: 'Recubrimiento cerámico' }).check({ force: true });
    await expect(estimate).toContainText('Sin estimar: Recubrimiento cerámico');
    await page.getByRole('button', { name: 'Reservar', exact: true }).click();
    await expect(page).toHaveURL('/my/reservations');

    // The day after, 3:00 p. m.: the same vehicle again (CA-01), both listed (CA-05).
    await book(day(2), /^3:00 p\. m\./);
    await expect(page).toHaveURL('/my/reservations');
    const pending = page.getByRole('list', { name: 'Próximas' });
    await expect(pending.getByRole('listitem')).toHaveCount(2);
    await expect(pending.getByText(/Suzuki GSX-R600/)).toHaveCount(2);

    // Tomorrow again, at another hour: refused, and nothing is created (CA-02).
    await book(day(1), /^5:00 p\. m\./);
    await expect(
      page.getByText(
        'Ya tienes una reserva ese día para ese vehículo (o sin vehículo): cámbiala si quieres otra hora.'
      )
    ).toBeVisible();
    const { count } = await adminClient()
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId)
      .eq('status', 'pending');
    expect(count).toBe(2);

    // «Inicio» shows the nearest one: tomorrow's, at 4:00 p. m. (CA-05).
    await page.goto('/my');
    await expect(
      page
        .getByRole('region', { name: 'Tu próxima reserva' })
        .getByText(/4:00 p\. m\. – 5:00 p\. m\./)
    ).toBeVisible();
  });
});
