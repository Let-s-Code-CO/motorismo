/**
 * Runs twice: in light and, as the «chromium-dark» project, on a device in dark mode (spec 010,
 * CA-03, CA-05, CA-13).
 *
 * Automatic accessibility audit (spec 003, CA-04): WCAG 2.1 A/AA rules, colour contrast included,
 * on the login, the home page and user management; spec 004 adds the sign-up, the data policy,
 * "Mi perfil", Clientes and a customer record; spec 005 the vehicles of a customer ("Mis vehículos"
 * in "Mi perfil" too), the vehicle form, the retired vehicles and the retire dialog; spec 006 the
 * "Sin conexión" page and notice, the new-version notice and the iPhone install notice and steps;
 * spec 007 «Servicios» and «Empleados» with their forms, the confirmation to disable and the
 * «Menú» of a phone (spec 009: the side panel, the account's menu, the home and the login band); spec 008 «Órdenes», a new order (with errors), the detail of an open order and
 * its close and void dialogs. Serious and
 * critical findings fail the test.
 */
import AxeBuilder from '@axe-core/playwright';
import { type Locator, type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, adminClient, signIn } from './support/sandbox';
import { refuseNoShow, saveAgendaSettings } from './support/toasts';

const audit = async (page: Page) => {
  // Every screen enters with a short fade (spec 011, `page-in`), and so do a floating notice
  // (spec 013) and «Ver todos» (filter bar): mid-fade, colours are blended and axe would measure a
  // contrast nobody sees (on the showroom grey of spec 019 such a blend dips below AA). Wait for
  // every animation that ends to do so first (none should run forever, WCAG 2.2.2 and spec 019
  // RN-02, which `ui.spec.ts` checks; one that did would otherwise stall the audit).
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime))
        .map((animation) => animation.finished)
    )
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`);
};

/**
 * Waits until an overlay (a dialog, a list of suggestions) finished its opening animation:
 * mid-fade, colours are blended and axe would measure a contrast nobody sees.
 */
const untilSettled = async (overlay: Locator) => {
  await expect(overlay).toBeVisible();
  await expect
    .poll(() =>
      overlay.evaluate((node) => {
        let opacity = 1;
        for (let el: Element | null = node; el; el = el.parentElement) {
          opacity *= Number(getComputedStyle(el).opacity);
        }
        return opacity;
      })
    )
    .toBe(1);
};

const untilDialogSettled = (page: Page) => untilSettled(page.getByRole('dialog'));

test('the login has no serious accessibility issues (CA-04)', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('home and user management have no serious accessibility issues (CA-04)', async ({ page }) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  expect(await audit(page)).toEqual([]);

  await page.goto('/admin/users');
  await expect(page.getByRole('grid')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('sign-up and data policy have no serious accessibility issues (spec 004)', async ({
  page,
}) => {
  await page.goto('/auth/sign-up');
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.goto('/privacy');
  await expect(
    page.getByRole('heading', { name: 'Política de tratamiento de datos personales' })
  ).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('"Mi perfil" has no serious accessibility issues (spec 004)', async ({ page }) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);
  await expect(page).toHaveURL('/my');
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('Clientes and a customer record have no serious accessibility issues (spec 004)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto('/customers');
  await expect(page.getByRole('grid')).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
  await expect(page.getByRole('heading', { name: SEED_CUSTOMERS.walkIn.name })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('the new-customer dialog and the edit form have no serious accessibility issues (spec 004)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto('/customers');
  await page.getByRole('button', { name: 'Nuevo cliente' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);

  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
  await page.getByRole('button', { name: 'Editar datos' }).click();
  await untilDialogSettled(page);
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('the vehicles of a customer and the vehicle form have no serious accessibility issues (spec 005)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  // Valentina has a vehicle in the seeds (a Mazda CX-30): the list with its colour and plate.
  await page.goto('/customers');
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
  const vehicles = page.getByRole('region', { name: 'Vehículos' });
  await expect(vehicles.getByText('Mazda CX-30')).toBeVisible();
  expect(await audit(page)).toEqual([]);

  // The form, then with the brand suggestions and the colour list open (keyboard: CA-15).
  await vehicles.getByRole('button', { name: 'Agregar vehículo' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);

  const dialog = page.getByRole('dialog', { name: 'Agregar vehículo' });
  await dialog.getByRole('combobox', { name: 'Marca' }).fill('ya');
  await untilSettled(page.getByRole('option', { name: 'Yamaha' }));
  expect(await audit(page)).toEqual([]);
  // Tab leaves the brand; the line opens its suggestions on focus, Tab leaves it too.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  await dialog.getByRole('button', { name: /Color/ }).focus();
  await page.keyboard.press('Enter');
  await untilSettled(page.getByRole('option', { name: 'Vinotinto' }));
  expect(await audit(page)).toEqual([]);

  // A car: the plate city with Bogotá, D.C., and its list of 1,104 cities open (HU-07, CA-28).
  await page.keyboard.press('Escape');
  await dialog.getByRole('radio', { name: 'Carro' }).check();
  await dialog.getByRole('combobox', { name: 'Ciudad de la placa' }).click();
  await untilSettled(page.getByRole('option', { name: /La Calera/ }));
  expect(await audit(page)).toEqual([]);
});

test('retired vehicles and the retire dialog have no serious accessibility issues (spec 005)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  // Camila (seeds) has UIH-03D active and JWJ-07 retired.
  await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
  const vehicles = page.getByRole('region', { name: 'Vehículos' });
  await vehicles.getByRole('button', { name: 'Vehículos retirados (1)' }).click();
  await expect(vehicles.getByRole('list', { name: 'Vehículos retirados (1)' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await vehicles.getByRole('button', { name: 'Retirar Suzuki GSX-R600' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
});

test('the "Sin conexión" page and notice have no serious accessibility issues (spec 006)', async ({
  page,
  context,
}) => {
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: 'Sin conexión', level: 1 })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  await expect(page.getByRole('grid')).toBeVisible();
  await context.setOffline(true);
  await untilSettled(page.getByRole('alert').filter({ hasText: 'Sin conexión' }));
  expect(await audit(page)).toEqual([]);
  await context.setOffline(false);
});

test.describe('the new-version notice (spec 006)', () => {
  // /api/version is answered with page.route, which only sees requests without a service worker.
  test.use({ serviceWorkers: 'block' });

  test('has no serious accessibility issues', async ({ page }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.route('**/api/version', (route) => route.fulfill({ json: { version: 'e2e-new' } }));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    await untilSettled(page.getByText('Hay una versión nueva'));
    expect(await audit(page)).toEqual([]);
  });
});

test.describe('the install notice and steps on an iPhone (spec 006)', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  });

  test('the install notice and the steps have no serious accessibility issues (CA-13, CA-18)', async ({
    page,
  }) => {
    await signIn(page, SEED_CUSTOMERS.customer.email);
    await untilSettled(page.getByText('Instala Motorismo en este dispositivo'));
    expect(await audit(page)).toEqual([]);

    await page.getByRole('button', { name: 'Instalar app' }).click();

    await untilDialogSettled(page);
    expect(await audit(page)).toEqual([]);
  });
});

test('«Servicios», its form and the confirmation to disable have no serious accessibility issues (spec 007)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/services');
  await expect(page.getByRole('grid', { name: 'Servicios activos' })).toBeVisible();
  await page.getByRole('button', { name: /^Desactivados/ }).click();
  expect(await audit(page)).toEqual([]);

  await page.getByRole('button', { name: 'Nuevo servicio' }).click();
  await untilDialogSettled(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar servicio' }).click();
  await expect(page.getByText('Escribe el nombre del servicio.')).toBeVisible();
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Acciones de Lavado sencillo' }).click();
  await page.getByRole('menuitem', { name: 'Desactivar' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
});

test('«Empleados» and its form, with the document types open, have no serious accessibility issues (spec 007)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/employees');
  await expect(page.getByRole('grid', { name: 'Empleados activos' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.getByRole('button', { name: 'Nuevo empleado' }).click();
  await untilDialogSettled(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar empleado' }).click();
  await expect(page.getByText('Escribe el número de documento.')).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.getByRole('button', { name: /Tipo de documento/ }).click();
  await untilSettled(page.getByRole('listbox'));
  expect(await audit(page)).toEqual([]);
});

test.describe('the phone experience (spec 007; spec 009)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the home, the side panel and the account's menu have no serious accessibility issues; a touch outside closes the panel (CA-03)", async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    expect(await audit(page)).toEqual([]);

    await page.getByRole('button', { name: 'Menú' }).click();
    const panel = page.getByRole('dialog', { name: 'Menú principal' });
    await untilSettled(panel);
    expect(await audit(page)).toEqual([]);
    // A touch outside the panel (on the right, over the dimmed page) closes it.
    await page.mouse.click(370, 400);
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Menú' })).toBeFocused();

    await page.getByRole('button', { name: /tu cuenta$/i }).click();
    await untilSettled(page.getByRole('menu', { name: 'Tu cuenta' }));
    expect(await audit(page)).toEqual([]);
  });

  test('the login with the brand band has no serious accessibility issues (CA-10)', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await expect(page.getByRole('banner', { name: 'Motorismo Detailing' })).toBeVisible();
    expect(await audit(page)).toEqual([]);
  });
});

test('«Órdenes», a new order with errors, an open order and its dialogs have no serious accessibility issues (spec 008)', async ({
  page,
}) => {
  const { data: open } = await adminClient()
    .from('work_orders')
    .select('id')
    .eq('status', 'open')
    .order('number')
    .limit(1)
    .single();
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');

  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'En proceso' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  // A new order for Valentina (one vehicle, chosen by itself), sent without services.
  await page.goto('/orders/new');
  await page.getByLabel('Buscar cliente').fill(SEED_CUSTOMERS.walkIn.name);
  await page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
  await page.getByRole('button', { name: 'Abrir orden' }).click();
  await expect(page.getByText('Añade al menos un servicio.')).toBeVisible();
  await page.getByRole('button', { name: 'Añadir Otro' }).click();
  expect(await audit(page)).toEqual([]);

  await page.goto(`/orders/${open!.id}`);
  await expect(page.getByRole('region', { name: 'Resumen de la orden' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.getByRole('button', { name: 'Cerrar y cobrar' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page
    .getByRole('region', { name: 'Anulación' })
    .getByRole('button', { name: 'Anular orden' })
    .click();
  await untilDialogSettled(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Anular orden' }).click();
  await expect(page.getByText('Escribe el motivo.')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('the agenda, a new reservation with errors, a reservation with its dialogs and «Horario» have no serious accessibility issues (spec 012)', async ({
  page,
}) => {
  const { data: reservation } = await adminClient()
    .from('reservations')
    .select('id, slot_start')
    // The seeded reservation of Camila tomorrow (seeds/06): other tests create and delete theirs.
    .eq('notes', 'Llego en la moto')
    .single();
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date(reservation!.slot_start)
  );
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto(`/agenda?date=${day}`);
  await expect(page.getByRole('list', { name: 'Franjas del día' })).toBeVisible();
  await untilSettled(page.locator('[data-page]'));
  expect(await audit(page)).toEqual([]);

  // Each screen enters with a short fade (spec 011): audited once it has settled.
  // Sent without a customer or a slot: the errors are in sight.
  await page.goto(`/agenda/new?date=${day}`);
  await page.getByRole('button', { name: 'Guardar reserva' }).click();
  await expect(page.getByText('Elige el cliente.')).toBeVisible();
  await untilSettled(page.locator('[data-page]'));
  expect(await audit(page)).toEqual([]);

  await page.goto(`/agenda/${reservation!.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await untilSettled(page.locator('[data-page]'));
  expect(await audit(page)).toEqual([]);

  await page.getByRole('button', { name: 'Cancelar reserva' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Cambiar tolerancia' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Volver' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/agenda/schedule');
  await expect(page.getByRole('heading', { name: 'Horario', level: 1 })).toBeVisible();
  await untilSettled(page.locator('[data-page]'));
  expect(await audit(page)).toEqual([]);
});

test('a screen still loading, with its skeleton, has no serious accessibility issues (spec 011, CA-03)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  // A bad signal, so the skeleton stays on screen while it is audited.
  // Fully loaded first, as for a real user (a tap before hydration is a plain page load).
  await page.waitForLoadState('networkidle');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 800,
    downloadThroughput: 30 * 1024,
    uploadThroughput: -1,
  });

  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Clientes', exact: true })
    .click();
  await expect(page.getByRole('status').filter({ hasText: 'Cargando…' })).toBeVisible();
  // Past its 300 ms appearance, fully drawn.
  await page.waitForTimeout(500);

  expect(await audit(page)).toEqual([]);
});

test('a confirmation and an error, floating, have no serious accessibility issues (spec 013, CA-11)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  const cleanup = await refuseNoShow(page);
  // The error stays; the confirmation arrives after it, on another screen.
  await saveAgendaSettings(page);

  expect(await audit(page)).toEqual([]);
  await cleanup();
});

test('the customer area, its booking form and the dialog to cancel have no serious accessibility issues (spec 014)', async ({
  page,
}) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);
  await expect(page).toHaveURL('/my');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  for (const [path, heading] of [
    ['/my/history', 'Historial'],
    ['/my/reservations/new', 'Reservar'],
    ['/my/reservations', 'Mis reservas'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    expect(await audit(page), path).toEqual([]);
  }

  // Camila's reservation of tomorrow, booked by herself (seeds).
  await page
    .getByRole('button', { name: /^Cancelar reserva del/ })
    .first()
    .click();
  await untilSettled(page.getByRole('dialog', { name: '¿Cancelar tu reserva?' }));
  expect(await audit(page)).toEqual([]);
});

test('the services report, filtered, with its list of employees open, has no serious accessibility issues (spec 015)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  const day = (days: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
      new Date(Date.now() - days * 24 * 60 * 60_000)
    );

  // The seeds' closed orders, by Camila's plate: rows, totals with the discount.
  await page.goto(`/reports/services?from=${day(15)}&to=${day(0)}&plate=UIH03D`);
  await expect(page.getByRole('table', { name: 'Servicios hechos' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  // The list of employees, with the disabled ones apart.
  await page.getByRole('button', { name: /Empleado/ }).click();
  await untilSettled(page.getByRole('listbox'));
  expect(await audit(page)).toEqual([]);
  await page.keyboard.press('Escape');

  // Empty, with «Quitar filtros».
  await page.goto(`/reports/services?from=${day(15)}&to=${day(0)}&plate=ZZZ99Z`);
  await expect(page.getByRole('link', { name: 'Quitar filtros' })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('the payroll of a month, an employee in detail and the dialog to close it have no serious accessibility issues (spec 016)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { data: elkin } = await adminClient()
    .from('employees')
    .select('id')
    .eq('full_name', 'Elkin Estrada')
    .single();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
  const [year, month] = today.split('-').map(Number) as [number, number];
  const lastMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto(`/reports/payroll?month=${lastMonth}`);
  await expect(page.getByRole('table', { name: 'Liquidación por empleado' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  // Closing or, if another test closed it, regenerating: the dialog asks first (then cancelled).
  await page
    .getByRole('button', { name: /^(Cerrar liquidación|Regenerar)$/ })
    .first()
    .click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

  await page.goto(`/reports/payroll/${elkin!.id}?month=${lastMonth}`);
  await expect(page.getByRole('heading', { name: 'Elkin Estrada', level: 1 })).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('«Mis datos» with its dialog to ask for the erasure has no serious accessibility issues (spec 017)', async ({
  page,
}) => {
  await signIn(page, SEED_CUSTOMERS.customer.email);
  await expect(page).toHaveURL('/my');
  await page.goto('/my/data');
  await expect(page.getByRole('heading', { name: 'Mis datos', level: 1 })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.getByRole('button', { name: 'Pedir la supresión de mis datos' }).click();
  await untilDialogSettled(page);
  expect(await audit(page)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
});

test('«Solicitudes de datos» and a request in detail have no serious accessibility issues (spec 017)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { data: request } = await adminClient()
    .from('data_requests')
    .select('id')
    .eq('kind', 'correction')
    .limit(1)
    .single();
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  await page.goto('/admin/data-requests');
  await expect(page.getByRole('list', { name: 'Solicitudes pendientes' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  await page.goto(`/admin/data-requests/${request!.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // With its errors in sight (CLAUDE.md: forms are audited with their errors).
  await page.getByRole('button', { name: 'Marcar atendida' }).click();
  await expect(page.getByText('Escribe la respuesta o el motivo.')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});

test('«Marcas y líneas», its rename dialog with an error and its merge dialog have no serious accessibility issues (spec 018)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');

  // The seeds' «Yamaja» (to review), its lines open by the search.
  await page.goto('/admin/vehicle-catalog?status=pending&q=yamaja');
  await expect(page.getByRole('list', { name: 'Líneas de Yamaja' })).toBeVisible();
  expect(await audit(page)).toEqual([]);

  // With its error in sight (CLAUDE.md: forms are audited with their errors).
  await page.getByRole('button', { name: 'Acciones de Yamaja' }).click();
  await page.getByRole('menuitem', { name: 'Renombrar' }).click();
  const rename = page.getByRole('dialog', { name: 'Renombrar la marca «Yamaja»' });
  await rename.getByRole('textbox', { name: 'Nombre' }).fill('');
  await rename.getByRole('button', { name: 'Guardar' }).click();
  await expect(rename.getByText('Escribe el nombre.')).toBeVisible();
  expect(await audit(page)).toEqual([]);
  await rename.getByRole('button', { name: 'Cancelar' }).click();

  // The merge, with the brand that stays chosen and what will happen in sight (not confirmed).
  await page.getByRole('button', { name: 'Acciones de Yamaja' }).click();
  await page.getByRole('menuitem', { name: 'Unir con otra marca' }).click();
  const merge = page.getByRole('dialog', { name: 'Unir la marca «Yamaja»' });
  await merge.getByRole('combobox', { name: 'Marca que queda' }).fill('Yamaha');
  await page.getByRole('option', { name: 'Yamaha', exact: true }).click();
  await expect(merge.getByText('No se puede deshacer.')).toBeVisible();
  // «Unir» fades in from disabled: audited once it has (mid-fade, its colours are blended).
  await expect(merge.getByRole('button', { name: 'Unir' })).toBeEnabled();
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished))
  );
  expect(await audit(page)).toEqual([]);
});
