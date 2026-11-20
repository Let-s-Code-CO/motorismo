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

const audit = async (page: Page) => {
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
  await expect(page).toHaveURL('/profile');
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
