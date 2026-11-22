/**
 * The agenda in a real browser (spec 012), on the local seeds (seeds/06: this week and the next
 * enabled from 9:00 to 18:00, 2 seats; reservations tomorrow at 10:00).
 *
 * - Block A: the admin enables a week with a day closed and another shortened (CA-26, CA-27); staff
 *   book a customer in a slot and see it in the agenda (CA-01, CA-05, CA-09); the day lives in the
 *   URL (CA-10); «Horario» is admin only (CA-32).
 * - Block B: a reservation whose time has come shows in the queue on its way (CA-18); «Llegó» opens
 *   «Nueva orden» with it, and leaving without saving keeps it pending (CA-12, CA-13); saving opens
 *   the order, which shows its reservation and goes in the queue by its reserved time (CA-14).
 * - Block C: a reservation moves to another slot (CA-20) and is cancelled (CA-21); one whose
 *   tolerance has passed is marked «No asistió» (CA-22); the admin gives one its own tolerance
 *   (CA-24).
 *
 * Reservations that depend on the time are written with the secret key, relative to now, so the
 * tests do not depend on the hour they run at (at night there are no slots left to book).
 */
import { type Page, expect, test } from '@playwright/test';

import {
  SEED,
  SEED_CUSTOMERS,
  adminClient,
  createWalkInCustomer,
  deleteCustomers,
  publicClient,
  signIn,
  uniquePlate,
} from './support/sandbox';

const TIME_ZONE = 'America/Bogota';

/** A day of Colombia, `days` from today, as `YYYY-MM-DD`. */
const dayFromToday = (days: number) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** That day at that time in Bogotá (UTC−5), as an instant. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00-05:00`).toISOString();
const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const created: string[] = [];
const customers: string[] = [];
const orders: string[] = [];
const weeks: string[] = [];

/** Writes a pending reservation directly (setup only), as the first admin. */
const reserve = async ({
  customerEmail,
  customerId,
  vehicleId,
  plate,
  start,
  minutes = 60,
  services = [],
}: {
  customerEmail?: string;
  customerId?: string;
  vehicleId?: string;
  plate?: string;
  start: string;
  minutes?: number;
  services?: string[];
}) => {
  const admin = adminClient();
  const [{ data: customer }, { data: profile }, { data: vehicle }, { data: catalog }] =
    await Promise.all([
      customerId
        ? Promise.resolve({ data: { id: customerId } })
        : admin.from('customers').select('id').eq('email', customerEmail!).single(),
      admin.from('profiles').select('id').eq('email', SEED.admin.email).single(),
      vehicleId
        ? Promise.resolve({ data: { id: vehicleId } })
        : plate
          ? admin.from('vehicles').select('id').eq('plate', plate).single()
          : Promise.resolve({ data: null }),
      admin.from('services').select('id, name').in('name', services),
    ]);
  const { data, error } = await admin
    .from('reservations')
    .insert({
      customer_id: customer!.id,
      vehicle_id: vehicle?.id ?? null,
      slot_start: start,
      slot_end: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(),
      created_by: profile!.id,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await admin.from('reservation_services').insert(
    services.map((name, index) => ({
      reservation_id: data.id,
      service_id: catalog!.find((service) => service.name === name)!.id,
      position: index + 1,
    }))
  );
  created.push(data.id);
  return data.id;
};

test.afterAll(async () => {
  const admin = adminClient();
  const { data: linked } = await admin
    .from('reservations')
    .select('work_order_id')
    .in('id', created);
  orders.push(
    ...(linked ?? []).flatMap(({ work_order_id }) => (work_order_id ? [work_order_id] : []))
  );
  await admin.from('reservation_extensions').delete().in('reservation_id', created);
  await admin.from('reservation_services').delete().in('reservation_id', created);
  await admin.from('reservations').delete().in('id', created);
  const { data: lines } = await admin
    .from('work_order_lines')
    .select('id')
    .in('work_order_id', orders);
  await admin
    .from('work_order_line_employees')
    .delete()
    .in(
      'line_id',
      (lines ?? []).map(({ id }) => id)
    );
  await admin.from('work_order_lines').delete().in('work_order_id', orders);
  await admin.from('work_orders').delete().in('id', orders);
  await deleteCustomers(customers);
  for (const week of weeks) {
    const { data: inWeek } = await admin
      .from('reservations')
      .select('id')
      .gte('slot_start', at(week, '00:00'))
      .lt('slot_start', at(dayFromWeek(week, 7), '00:00'));
    const ids = (inWeek ?? []).map(({ id }) => id);
    await admin.from('reservation_services').delete().in('reservation_id', ids);
    await admin.from('reservations').delete().in('id', ids);
    await admin.from('agenda_days').delete().eq('week_start', week);
    await admin.from('agenda_weeks').delete().eq('week_start', week);
  }
});

const dayFromWeek = (week: string, days: number) => {
  const date = new Date(`${week}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** The Monday of a week far enough ahead to be free of other tests (about 20 weeks). */
const farMonday = () => {
  const day = dayFromToday(140);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return dayFromWeek(day, -((weekday + 6) % 7));
};

const slot = (page: Page, range: string) => page.getByRole('listitem', { name: range });

test.describe('the agenda (spec 012)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the admin enables a week, closes a day and shortens another; staff book a customer and see them in the agenda (CA-01, CA-05, CA-09, CA-26, CA-27)', async ({
    page,
  }) => {
    const monday = farMonday();
    weeks.push(monday);
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await page.goto(`/agenda/schedule?week=${monday}`);
    await expect(
      page.getByText('Propuesta: todos los días de 9:00 a. m. a 6:00 p. m.')
    ).toBeVisible();
    await page
      .getByRole('listitem', { name: /domingo/ })
      .getByRole('switch')
      .click();
    await page
      .getByRole('listitem', { name: /sábado/ })
      .getByLabel('Cierra')
      .fill('13:00');
    await page.getByRole('button', { name: 'Guardar semana' }).click();
    await expect(page.getByText('Semana guardada.')).toBeVisible();

    await page.goto(`/agenda?date=${dayFromWeek(monday, 6)}`);
    await expect(page.getByText('Este día no se atiende.')).toBeVisible();
    await page.goto(`/agenda?date=${dayFromWeek(monday, 5)}`);
    // Saturday until 13:00: 4 slots, each with its seats.
    await expect(page.getByRole('list', { name: /^Puestos de / })).toHaveCount(4);

    // Staff book Camila, whose only active vehicle comes chosen, on Monday at 10:00.
    await page.goto(`/agenda/new?date=${monday}`);
    await page.getByLabel('Buscar cliente').fill('Camila');
    await page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
    await expect(page.getByRole('radio', { name: /UIH-03D/ })).toBeChecked();
    await page.getByRole('radio', { name: /^10:00 a\. m\./ }).check({ force: true });
    await page.getByRole('checkbox', { name: 'Lavado detallado' }).check({ force: true });
    await page.getByRole('button', { name: 'Guardar reserva' }).click();

    await expect(page).toHaveURL(/\/agenda\/[0-9a-f-]{36}$/);
    created.push(page.url().split('/agenda/')[1]!.split('?')[0]!);
    await expect(
      page.getByRole('region', { name: 'Avisos' }).getByText('Reserva guardada.')
    ).toBeVisible();
    // Spec 013, CA-05: the notice is not in the address: a reload does not repeat it.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Avisos' })).not.toContainText(
      'Reserva guardada.'
    );

    await page.goto(`/agenda?date=${monday}`);
    const ten = slot(page, '10:00 a. m. – 11:00 a. m.');
    await expect(ten.getByText('1 de 2 libres')).toBeVisible();
    await expect(
      ten.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) })
    ).toContainText('Lavado detallado');
  });

  test('the day lives in the URL: the next day survives a reload (CA-10)', async ({ page }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    const tomorrow = dayFromToday(1);

    await page.goto(`/agenda?date=${tomorrow}`);
    await page.getByRole('button', { name: 'Día siguiente' }).click();
    await expect(page).toHaveURL(`/agenda?date=${dayFromToday(2)}`);
    await page.reload();
    await expect(page).toHaveURL(`/agenda?date=${dayFromToday(2)}`);
  });

  test('«Horario» is only for an admin (CA-32)', async ({ page }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');

    await page.goto('/agenda/schedule');
    await expect(page.getByText('No tienes permiso para ver esta página.')).toBeVisible();
  });
});

test.describe('the customer arrives (spec 012, HU-03)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a reservation on its way shows in the queue; «Llegó» opens its order, which keeps its turn (CA-12, CA-13, CA-14, CA-18)', async ({
    page,
  }) => {
    // Its own customer and motorcycle: no other test opens an order for them meanwhile.
    const name = `E2E Llegada ${Date.now()}`;
    const customerId = await createWalkInCustomer(name);
    customers.push(customerId);
    const operator = publicClient();
    await operator.auth.signInWithPassword({ email: SEED.operator.email, password: SEED.password });
    const { data: vehicleId } = await operator.rpc('save_vehicle', {
      p_customer_id: customerId,
      p_vehicle_type: 'motorcycle',
      p_brand_name: 'Suzuki',
      p_line_name: 'GSX-R600',
      p_color: 'black',
      p_plate: uniquePlate('motorcycle'),
    });
    const id = await reserve({
      customerId,
      vehicleId: vehicleId!,
      start: minutesFromNow(-5),
      services: ['Lavado sencillo'],
    });
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');

    await page.goto('/orders');
    const queue = page.getByRole('list', { name: 'Órdenes en cola' });
    await expect(
      queue.getByRole('link', {
        name: new RegExp(`^Reserva por llegar.*${name}`),
      })
    ).toHaveAttribute('href', `/agenda/${id}?from=orders`);

    // Leaving «Nueva orden» without saving keeps it pending (CA-13).
    await page.goto(`/agenda/${id}`);
    await page.getByRole('button', { name: 'Llegó' }).click();
    await expect(page).toHaveURL(`/orders/new?reservation=${id}`);
    await expect(page.getByText(/^Llegó con la reserva de las/)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Lavado sencillo' })).toBeVisible();
    await page.goto(`/agenda/${id}`);
    await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Llegó' }).click();
    await expect(page.getByRole('group', { name: 'Lavado sencillo' })).toBeVisible();
    await page.getByRole('button', { name: 'Abrir orden' }).click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole('region', { name: 'Avisos' }).getByText('Orden abierta.')
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /^Viene de la reserva de las/ })).toHaveAttribute(
      'href',
      `/agenda/${id}`
    );

    await page.goto('/orders');
    const entry = queue.getByRole('listitem').filter({ hasText: name });
    await expect(entry).toContainText(/Reserva \d{1,2}:\d{2} [ap]\. m\./);
    // Valentina is no longer on her way (the seeds keep another reservation on its way).
    await expect(
      queue.getByRole('link', {
        name: new RegExp(`^Reserva por llegar.*${name}`),
      })
    ).toHaveCount(0);

    await page.goto(`/agenda/${id}`);
    await expect(page.getByText('Atendida', { exact: true })).toBeVisible();
  });
});

test.describe('changing, cancelling and no-shows (spec 012, HU-04)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a reservation moves to another slot and then is cancelled (CA-20, CA-21)', async ({
    page,
  }) => {
    const tomorrow = dayFromToday(1);
    const id = await reserve({
      customerEmail: SEED_CUSTOMERS.customer.email,
      start: at(tomorrow, '15:00'),
    });
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');

    await page.goto(`/agenda/${id}`);
    await page.getByRole('button', { name: 'Cambiar' }).click();
    await page.getByRole('radio', { name: /^4:00 p\. m\./ }).check({ force: true });
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(
      page.getByRole('region', { name: 'Avisos' }).getByText('Reserva guardada.')
    ).toBeVisible();
    await expect(page.getByText(/4:00 p\. m\. – 5:00 p\. m\./)).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar reserva' }).click();
    const dialog = page.getByRole('dialog', { name: 'Cancelar la reserva' });
    await dialog.getByLabel('Motivo (opcional)').fill('Se le dañó la moto');
    await dialog.getByRole('button', { name: 'Cancelar reserva' }).click();
    await expect(page.getByText('Reserva cancelada.')).toBeVisible();
    await expect(page.getByText('Motivo: Se le dañó la moto')).toBeVisible();
  });

  test('a reservation past its tolerance is marked «No asistió» (CA-22)', async ({ page }) => {
    const id = await reserve({
      customerEmail: SEED_CUSTOMERS.customer.email,
      start: minutesFromNow(-70),
    });
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');

    await page.goto(`/agenda/${id}`);
    await page.getByRole('button', { name: 'No asistió' }).click();
    await expect(page.getByText('Reserva marcada como «No asistió».')).toBeVisible();
  });

  test('the admin gives a reservation its own tolerance (CA-24)', async ({ page }) => {
    const id = await reserve({
      customerEmail: SEED_CUSTOMERS.customer.email,
      start: at(dayFromToday(1), '17:00'),
    });
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await page.goto(`/agenda/${id}`);
    await expect(page.getByText('15 min (la general)')).toBeVisible();
    await page.getByRole('button', { name: 'Cambiar tolerancia' }).click();
    const dialog = page.getByRole('dialog', { name: 'Tolerancia de esta reserva' });
    await dialog.getByRole('checkbox', { name: 'Usar la general' }).uncheck({ force: true });
    await dialog.getByLabel('Minutos (de 0 a 60)').fill('30');
    await dialog.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('30 min (propia de esta reserva)')).toBeVisible();
  });
});

test.describe('up to date without reloading (spec 012, HU-06)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a reservation written meanwhile appears in the queue by itself; «+5 min» gives more time, recorded in the reservation (CA-34, CA-35, CA-38, CA-39)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto('/orders');
    const queue = page.getByRole('list', { name: 'Órdenes en cola' });
    const arriving = queue.getByRole('link', {
      name: new RegExp(`^Reserva por llegar.*${SEED_CUSTOMERS.phoneOnly.name}`),
    });
    await expect(arriving).toHaveCount(0);

    // Someone else books Andrés for a minute ago: no reload here.
    // Andrés was registered at the counter with a phone only: written directly, as setup.
    const admin = adminClient();
    const [{ data: customer }, { data: profile }] = await Promise.all([
      admin.from('customers').select('id').eq('full_name', SEED_CUSTOMERS.phoneOnly.name).single(),
      admin.from('profiles').select('id').eq('email', SEED.admin.email).single(),
    ]);
    const start = minutesFromNow(-1);
    const { data: booked } = await admin
      .from('reservations')
      .insert({
        customer_id: customer!.id,
        slot_start: start,
        slot_end: new Date(new Date(start).getTime() + 3_600_000).toISOString(),
        created_by: profile!.id,
      })
      .select('id')
      .single();
    const id = booked!.id;
    created.push(id);

    await expect(arriving).toHaveAttribute('href', `/agenda/${id}?from=orders`, {
      timeout: 15_000,
    });
    const row = queue
      .getByRole('listitem')
      .filter({ hasText: 'Reserva por llegar' })
      .filter({ hasText: SEED_CUSTOMERS.phoneOnly.name });
    await expect(row).toContainText(/quedan 1[45] min/);

    await row
      .getByRole('button', { name: new RegExp(`${SEED_CUSTOMERS.phoneOnly.name}: \\+5 min$`) })
      .click();
    await expect(
      page.getByText(new RegExp(`^${SEED_CUSTOMERS.phoneOnly.name} conserva su turno hasta las`))
    ).toBeVisible();
    await expect(row).toContainText(/quedan (19|20) min/);
    await expect(row).toContainText('Ya se le dio +5 min (1 vez)');

    // CA-38: the reservation keeps the record; opened from the queue, «Volver» comes back here.
    await arriving.click();
    await expect(page).toHaveURL(`/agenda/${id}?from=orders`);
    await expect(page.getByRole('region', { name: 'Más tiempo para llegar' })).toContainText(
      `+5 min, dados por ${SEED.operator.name}`
    );
    await page.getByRole('link', { name: 'Volver a órdenes' }).click();
    await expect(page).toHaveURL('/orders');
  });
});
