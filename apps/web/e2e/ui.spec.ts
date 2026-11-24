/**
 * Layout checks of the redesign (spec 003).
 * CA-02 no horizontal scroll on a 360 px phone (spec 004 adds sign-up, Clientes, a customer record
 * and "Mi perfil": the customer signs up from their phone; spec 005 the vehicles and their form) · CA-03 brand panel beside the form on desktop only ·
 * every clickable element shows the hand cursor (Tailwind 4 no longer sets it on buttons) ·
 * placeholders look muted, distinct from typed text (theme foreground scale).
 * Spec 009 (phone experience): an app's header (CA-01) whose «Menú» opens a side panel (CA-02);
 * the staff home as two columns of tiles with the open orders on «Órdenes» and no «Muy pronto»
 * (CA-06 to CA-08); the sign-in pages with the brand band on top, «Entrar» in sight and no motion
 * when the device asks for less (CA-10 to CA-12); the desktop as before (CA-05, CA-09, CA-13).
 * Spec 012: the agenda, a new reservation, a reservation and «Horario» fit a phone too.
 * Spec 015: the services report fits an iPhone, a card per service.
 * Spec 016: the payroll and an employee's detail fit an iPhone, a card per employee.
 * Spec 018: «Marcas y líneas» fits a phone, its lines open; the desktop bar never overflows and,
 * with today's sections, needs no «Más» for an admin or an operator (CA-22, CA-25).
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, adminClient, signIn } from './support/sandbox';
import { SETTINGS_SAVED, saveAgendaSettings, toast } from './support/toasts';

type Box = { x: number; y: number; width: number; height: number };

/** A day of Colombia, `days` before today. */
const bogotaDay = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(
    new Date(Date.now() - days * 24 * 60 * 60_000)
  );

const horizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('on a 360 px phone', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('login, home and users have no horizontal scroll (CA-02)', async ({ page }) => {
    await page.goto('/auth/login');
    expect(await horizontalOverflow(page)).toBe(0);

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    expect(await horizontalOverflow(page)).toBe(0);

    await page.goto('/admin/users');
    await expect(page.getByRole('grid')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    // Spec 018: the catalog, the lines of its brands open (a search shows them).
    await page.goto('/admin/vehicle-catalog?q=a');
    await expect(page.getByRole('list', { name: 'Marcas' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.goto('/customers');
    await expect(page.getByRole('grid')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await expect(page.getByRole('heading', { name: SEED_CUSTOMERS.walkIn.name })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('a new order and the detail of an open order have no horizontal scroll (spec 008)', async ({
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

    await page.goto('/orders/new');
    await page.getByLabel('Buscar cliente').fill(SEED_CUSTOMERS.walkIn.name);
    await page.getByRole('button', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: 'Añadir Lavado detallado' }).click();
    await page.getByRole('button', { name: 'Añadir Otro' }).click();
    // The summary stays in sight at the bottom.
    await expect(page.getByRole('region', { name: 'Resumen de la orden' })).toBeInViewport();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.goto(`/orders/${open!.id}`);
    await expect(page.getByRole('region', { name: 'Resumen de la orden' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('the agenda, a new reservation with its slots, a reservation and «Horario» have no horizontal scroll (spec 012)', async ({
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

    for (const path of [
      `/agenda?date=${day}`,
      `/agenda/new?date=${day}`,
      `/agenda/${reservation!.id}`,
      `/agenda/${reservation!.id}?edit=1`,
      '/agenda/schedule',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect.poll(() => horizontalOverflow(page), { message: path }).toBe(0);
    }
  });

  test('with every staff section, the menu fits: «Menú» opens the side panel; a long service fits too (spec 007, CA-19; spec 009, CA-02)', async ({
    page,
  }) => {
    // A long name with high prices in every type: the widest row «Servicios» can have.
    const longName = `E2E Servicio con un nombre bastante largo para un teléfono ${Date.now()}`;
    await adminClient().from('services').insert({
      name: longName,
      price_motorcycle: 9_500_000,
      price_car: 9_800_000,
      price_bicycle: 9_900_000,
    });
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: 'Menú' }).click();
    const panel = page.getByRole('dialog', { name: 'Menú principal' });
    await panel.getByRole('link', { name: 'Servicios' }).click();
    await expect(page).toHaveURL('/services');
    // Measured once the panel has closed: it is not part of the page.
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('grid', { name: 'Servicios activos' })).toContainText(longName);
    // The steady state: the panel may still be animating out for a moment under load.
    await expect.poll(() => horizontalOverflow(page)).toBe(0);
    await adminClient().from('services').delete().eq('name', longName);
  });

  test('the vehicles of a customer and the vehicle form have no horizontal scroll (spec 005)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto('/customers');
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    const vehicles = page.getByRole('region', { name: 'Vehículos' });
    await expect(vehicles.getByText('Mazda CX-30')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await vehicles.getByRole('button', { name: 'Agregar vehículo' }).click();
    const dialog = page.getByRole('dialog', { name: 'Agregar vehículo' });
    await dialog.getByRole('radio', { name: 'Carro' }).check();
    await expect(dialog.getByRole('radio', { name: 'Camioneta' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('sign-up and "Mi perfil" have no horizontal scroll (spec 004)', async ({ page }) => {
    await page.goto('/auth/sign-up');
    expect(await horizontalOverflow(page)).toBe(0);

    await signIn(page, SEED_CUSTOMERS.customer.email);
    await expect(page).toHaveURL('/my');
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('every sign-in page shows the brand band on top, not the side panel, and fits (spec 009, CA-10)', async ({
    page,
  }) => {
    // «Nueva contraseña» needs an invitation or recovery link: invite and password-reset tests.
    for (const path of [
      '/auth/login',
      '/auth/sign-up',
      '/auth/forgot-password',
      '/auth/invalid-link?type=email',
    ]) {
      await page.goto(path);
      const band = page.getByRole('banner', { name: 'Motorismo Detailing' });
      await expect(band, path).toBeVisible();
      await expect(band.getByText('Especialistas en PPF y Detailing')).toBeVisible();
      await expect(band.getByRole('img', { name: 'Logo de Motorismo Detailing' })).toBeVisible();
      await expect(page.getByRole('complementary', { name: 'Motorismo Detailing' })).toBeHidden();
      expect(await horizontalOverflow(page), path).toBe(0);
    }
  });
});

test.describe('on an iPhone (440 px, touch, iPhone browser)', () => {
  test.use({
    viewport: { width: 440, height: 956 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  });

  test('every staff screen of specs 007, 008, 012, 015, 016 and 017 has no horizontal scroll', async ({
    page,
  }) => {
    const { data: open } = await adminClient()
      .from('work_orders')
      .select('id, customer_id')
      .eq('status', 'open')
      .order('number')
      .limit(1)
      .single();
    // Spec 017: a data request of the seeds.
    const { data: camilaRequest } = await adminClient()
      .from('data_requests')
      .select('id')
      .eq('kind', 'correction')
      .limit(1)
      .single();
    // Spec 016: an employee of the payroll, for its detail.
    const { data: elkin } = await adminClient()
      .from('employees')
      .select('id')
      .eq('full_name', 'Elkin Estrada')
      .single();
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    for (const path of [
      '/',
      '/orders',
      '/orders/new',
      `/orders/${open!.id}`,
      `/customers/${open!.customer_id}`,
      '/services',
      '/employees',
      // Spec 012.
      '/agenda',
      '/agenda/new',
      '/agenda/schedule',
      // Spec 015: the services report, on the seeds' closed orders (a card per service).
      `/reports/services?from=${bogotaDay(15)}&to=${bogotaDay(0)}`,
      // Spec 016: the payroll of the month and an employee's detail.
      '/reports/payroll',
      `/reports/payroll/${elkin!.id}`,
      // Spec 017: the data requests and one of them (Camila's, from the seeds).
      '/admin/data-requests',
      `/admin/data-requests/${camilaRequest!.id}`,
      // Spec 018: the catalog, with the lines open.
      '/admin/vehicle-catalog?status=pending&q=a',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await expect.poll(() => horizontalOverflow(page), { message: path }).toBe(0);
    }

    // Spec 009: with the side panel or the account's menu open, nothing scrolls sideways either.
    await page.goto('/');
    await page.getByRole('button', { name: 'Menú' }).click();
    await expect(page.getByRole('dialog', { name: 'Menú principal' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Menú principal' })).toHaveCount(0);
    await page.getByRole('button', { name: /tu cuenta$/i }).click();
    await expect(page.getByRole('menu', { name: 'Tu cuenta' })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
    await page.keyboard.press('Escape');

    // Spec 013, CA-02: a floating notice, at the bottom and full width (440 − 2 × 16 = 408).
    await saveAgendaSettings(page);
    const notice = toast(page, SETTINGS_SAVED);
    await expect(notice).toBeInViewport();
    expect(Math.round((await notice.boundingBox())!.width)).toBe(408);
    // Above the install banner of this iPhone (spec 006), not over it.
    const banner = page
      .getByText('Instala Motorismo en este dispositivo')
      .locator('xpath=ancestor::*[contains(@class, "sticky")][1]');
    await expect(banner).toBeVisible();
    await expect
      .poll(async () => {
        const [top, bottom] = await Promise.all([
          banner.boundingBox().then((box) => box!.y),
          notice.boundingBox().then((box) => box!.y + box!.height),
        ]);
        return bottom < top;
      })
      .toBe(true);
    expect(await horizontalOverflow(page)).toBe(0);
  });
  test('the customer area has no horizontal scroll (specs 014 and 017)', async ({ page }) => {
    await signIn(page, SEED_CUSTOMERS.customer.email);
    await expect(page).toHaveURL('/my');

    for (const path of [
      '/my',
      '/my/history',
      '/my/reservations',
      '/my/reservations/new',
      '/profile',
      // Spec 017.
      '/my/data',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      await expect.poll(() => horizontalOverflow(page), { message: path }).toBe(0);
    }
  });
});

test.describe('on an iPhone (390 × 844) — the phone experience (spec 009)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 3,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  });

  test('the header shows only «Menú», the logo in the centre and the avatar (CA-01)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    const header = page.locator('header').first();
    await expect(header.getByRole('button', { name: 'Menú' })).toBeVisible();
    await expect(header.getByRole('button', { name: /tu cuenta$/i })).toBeVisible();
    const logo = header.getByRole('link', { name: 'Motorismo Detailing, ir al inicio' });
    await expect(logo).toBeVisible();
    // Nothing else: the inline sections and «Cerrar sesión» live in the panel and the avatar.
    await expect(header.getByRole('navigation', { name: 'Navegación principal' })).toBeHidden();
    await expect(header.getByRole('button', { name: 'Cerrar sesión' })).toBeHidden();
    // Centred: the logo's centre is the screen's (390 / 2 = 195), give or take 2 px.
    const box = (await logo.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - 195)).toBeLessThanOrEqual(2);
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('with the panel open, screen readers do not read the page behind it (CA-03)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('main')).toBeVisible();

    await page.getByRole('button', { name: 'Menú' }).click();
    await expect(page.getByRole('dialog', { name: 'Menú principal' })).toBeVisible();

    // Hidden from the accessibility tree while the panel is open; back once it closes.
    await expect(page.getByRole('main')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test("the tiles use the menu's short names: «Usuarios», not «Gestionar usuarios» (CA-06)", async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    const tiles = page.getByRole('list', { name: 'Secciones' });
    await expect(tiles.getByRole('link', { name: 'Usuarios', exact: true })).toBeVisible();
    await expect(tiles.getByText('Gestionar usuarios')).toBeHidden();
  });

  test('the home leads with «Órdenes» and what is open, then tiles in two columns, centred, without «Muy pronto» (CA-06 to CA-08; spec 012 adds «Agenda»)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');

    const tiles = page.getByRole('list', { name: 'Secciones' }).getByRole('link');
    await expect(tiles).toHaveCount(5);
    // The page comes in 6 px low (spec 011, `page-in`): measured mid-way, the greeting is off
    // against `main` (slow runs caught it). Measure once it has settled.
    await page
      .locator('[data-page]')
      .evaluate((node) => Promise.all(node.getAnimations().map((animation) => animation.finished)));
    const [orders, agenda, customers, services, employees] = (await Promise.all(
      [0, 1, 2, 3, 4].map(async (index) => (await tiles.nth(index).boundingBox())!)
    )) as [Box, Box, Box, Box, Box];
    // «Órdenes» leads, full width; then two per row: Agenda and Clientes, Servicios and Empleados
    // (spec 012 added «Agenda»: no lone last tile for an operator any more).
    expect(Math.abs(agenda.y - customers.y)).toBeLessThanOrEqual(1);
    expect(customers.x).toBeGreaterThan(agenda.x + agenda.width - 1);
    expect(agenda.y).toBeGreaterThan(orders.y + orders.height - 1);
    expect(Math.abs(orders.width - (customers.x + customers.width - agenda.x))).toBeLessThanOrEqual(
      1
    );
    expect(Math.abs(services.y - employees.y)).toBeLessThanOrEqual(1);
    expect(services.y).toBeGreaterThan(agenda.y + agenda.height - 1);
    // Centred in the screen, not stuck to the top: about as much room above as below.
    const main = (await page.getByRole('main').boundingBox())!;
    const greeting = (await page.getByRole('heading', { name: /Hola/ }).boundingBox())!;
    const above = greeting.y - main.y;
    const below = main.y + main.height - (employees.y + employees.height);
    expect(Math.abs(above - below)).toBeLessThanOrEqual(8);
    // No description on a phone; the open orders on «Órdenes» (CA-07).
    await expect(
      page.getByText('Consulta, busca y registra a los clientes del negocio.')
    ).toBeHidden();
    await expect(tiles.first()).toContainText(/\d+En proceso\d+En cola|Sin órdenes abiertas/);
    await expect(page.getByText('Muy pronto')).toBeHidden();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('with a slow network, a loading screen and its content fit the phone (spec 011, CA-05)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
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

    await page.getByRole('button', { name: 'Menú' }).click();
    await page
      .getByRole('dialog', { name: 'Menú principal' })
      .getByRole('link', { name: 'Órdenes' })
      .click();
    await expect(page.locator('[data-skeleton="list"]')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
    // Not merely clipped by the app's safety net: every shape fits inside the screen.
    const overflowingShapes = await page.evaluate(
      () =>
        [...document.querySelectorAll('[data-skeleton] [data-shape]')].filter(
          (shape) => shape.getBoundingClientRect().right > window.innerWidth
        ).length
    );
    expect(overflowingShapes).toBe(0);

    await expect(page.getByRole('heading', { name: 'Órdenes', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('the login keeps «Entrar» in sight below the brand band (CA-10, CA-11)', async ({
    page,
  }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('banner', { name: 'Motorismo Detailing' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeInViewport();
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test('the band moves only when the device allows motion (CA-12)', async ({ page }) => {
    const shine = page.locator('[data-ornament="shine"]').last();
    const animation = () => shine.evaluate((element) => getComputedStyle(element).animationName);

    await page.goto('/auth/login');
    expect(await animation()).toBe('shine');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    expect(await animation()).toBe('none');
  });
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const [role, email, inBar] of [
    ['an admin', SEED.admin.email, ['Inicio', 'Órdenes', 'Agenda', 'Clientes', 'Administración']],
    [
      'an operator',
      SEED.operator.email,
      ['Inicio', 'Órdenes', 'Agenda', 'Clientes', 'Servicios', 'Empleados'],
    ],
  ] as const) {
    test(`the bar of ${role} fits from 1024 px up, all in line and without «Más» (spec 018, CA-21, CA-22, CA-25)`, async ({
      page,
    }) => {
      await signIn(page, email);
      await expect(page).toHaveURL('/');
      const nav = page.getByRole('navigation', { name: 'Navegación principal' });
      for (const width of [1024, 1440]) {
        await page.setViewportSize({ width, height: 800 });
        await expect(nav.getByRole('button', { name: 'Más' })).toHaveCount(0);
        await expect(nav.getByRole('listitem')).toHaveText([...inBar]);
        const overflow = await nav.evaluate((element) => element.scrollWidth - element.clientWidth);
        expect(overflow, `${width} px`).toBeLessThanOrEqual(0);
        expect(await horizontalOverflow(page)).toBe(0);
      }
    });
  }

  test('the login shows the brand panel beside the form, without the band (CA-03; spec 009, CA-13)', async ({
    page,
  }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('complementary', { name: 'Motorismo Detailing' })).toBeVisible();
    await expect(page.getByRole('banner', { name: 'Motorismo Detailing' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });

  test('the header and the home are as before; «Órdenes» dark, the same size, with the open orders (spec 009, CA-05, CA-09)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');

    const header = page.locator('header').first();
    await expect(
      header
        .getByRole('navigation', { name: 'Navegación principal' })
        .getByRole('link', { name: 'Órdenes', exact: true })
    ).toBeVisible();
    await expect(header.getByText(SEED.admin.name)).toBeVisible();
    await expect(header.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    await expect(header.getByRole('button', { name: 'Menú' })).toBeHidden();
    await expect(header.getByRole('button', { name: /tu cuenta$/i })).toBeHidden();

    await expect(
      page.getByText('Consulta, busca y registra a los clientes del negocio.')
    ).toBeVisible();
    // Spec 018: nothing left to announce as «Muy pronto».
    await expect(page.getByText('Muy pronto')).toHaveCount(0);
    await expect(
      page.getByRole('list', { name: 'Secciones' }).getByRole('link').first()
    ).toContainText(/\d+En proceso\d+En cola|Sin órdenes abiertas/);

    // «Órdenes» is dark like the brand panel, and the same size as the other cards.
    const tiles = page.getByRole('list', { name: 'Secciones' }).getByRole('link');
    const background = (index: number) =>
      tiles.nth(index).evaluate((element) => getComputedStyle(element).backgroundColor);
    const zinc950 = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'bg-zinc-950';
      document.body.append(probe);
      const colour = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return colour;
    });
    expect(await background(0)).toBe(zinc950);
    expect(await background(1)).not.toBe(zinc950);
    const [orders, customers] = (await Promise.all(
      [0, 1].map(async (index) => (await tiles.nth(index).boundingBox())!)
    )) as [Box, Box];
    expect(Math.abs(orders.width - customers.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(orders.height - customers.height)).toBeLessThanOrEqual(1);
  });
});

test.describe('pointer cursor', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  const cursorOf = (locator: import('@playwright/test').Locator) =>
    locator.evaluate((element) => getComputedStyle(element).cursor);

  test('custom buttons show the hand cursor: password toggle and summary filters', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    expect(await cursorOf(page.getByRole('button', { name: 'Mostrar contraseña' }))).toBe(
      'pointer'
    );

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto('/admin/users');
    expect(await cursorOf(page.getByRole('button', { name: /^Activos \d+$/ }))).toBe('pointer');
  });

  /**
   * The rule (asked by the user, 2026-11-24): whatever lights up under the mouse shows the hand, and
   * over all of it, its text included. What changes on hover (background, text, border, shadow) is
   * clickable; what is not clickable does not light up.
   */
  const litWithoutHand = (page: Page) =>
    page.evaluate(() => {
      const lit = [
        ...document.querySelectorAll<HTMLElement>(
          'main [class*="hover:"], header [class*="hover:"]'
        ),
      ]
        .filter((element) =>
          /(^|\s)hover:(bg|text|border|shadow|underline)/.test(element.className)
        )
        .filter((element) => !element.closest('[aria-disabled="true"], :disabled, [inert]'))
        .filter((element) => element.getClientRects().length > 0);
      const misses: string[] = [];
      for (const element of lit) {
        element.scrollIntoView({ block: 'center', inline: 'center' });
        // Where the mouse would be: the middle of the element and of each of its texts.
        const points = [element, ...element.querySelectorAll<HTMLElement>('*')]
          .filter(
            (part) =>
              part === element ||
              [...part.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim())
          )
          .map((part) => part.getBoundingClientRect())
          .filter((box) => box.width > 0 && box.height > 0)
          .map((box) => [box.left + box.width / 2, box.top + box.height / 2] as const);
        for (const [x, y] of points) {
          const under = document.elementFromPoint(x, y);
          if (!under) continue;
          // Something else on top takes the mouse (and the click): that is a miss too.
          if (!element.contains(under) && !under.contains(element)) {
            misses.push(
              `«${element.textContent?.trim().slice(0, 30)}» covered by ${under.tagName.toLowerCase()}.${String(under.className).slice(0, 40)}`
            );
            continue;
          }
          if (getComputedStyle(under).cursor !== 'pointer') {
            misses.push(
              `«${element.textContent?.trim().slice(0, 30)}» → ${under.tagName.toLowerCase()} «${under.textContent?.trim().slice(0, 20)}»`
            );
          }
        }
      }
      return [...new Set(misses)];
    });

  test('whatever lights up on hover shows the hand, over all of it (staff screens)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    for (const path of [
      '/',
      '/orders',
      '/agenda',
      '/customers',
      '/reports/services',
      '/reports/payroll',
      '/admin/data-requests',
      // Spec 018: the brands, their lines open, and their action buttons.
      '/admin/vehicle-catalog?q=a',
    ]) {
      if (path !== '/') await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await litWithoutHand(page), path).toEqual([]);
    }
  });

  test('whatever lights up on hover shows the hand, over all of it (customer screens)', async ({
    page,
  }) => {
    await signIn(page, SEED_CUSTOMERS.customer.email);
    await expect(page).toHaveURL('/my');
    for (const path of ['/my', '/my/history', '/my/reservations', '/my/data', '/profile']) {
      if (path !== '/my') await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await litWithoutHand(page), path).toEqual([]);
    }
  });

  /** The animations running now that never end, or end later than 5 s after the page opened. */
  const endlessAnimations = (page: Page) =>
    page.evaluate(() =>
      document.getAnimations().flatMap((animation) => {
        const timing = animation.effect?.getComputedTiming();
        const end = Number(timing?.endTime ?? Infinity);
        const name = (animation as CSSAnimation).animationName ?? 'animation';
        return end > 5000 ? [`${name} ends at ${end} ms`] : [];
      })
    );

  test('nothing moves forever: the brand’s shine and sparkles play once and stop within 5 s (WCAG 2.2.2; an endless one made macOS browsers flicker the cursor)', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await expect(page.locator('[data-ornament="shine"]').first()).toBeAttached();
    expect(await endlessAnimations(page), '/auth/login').toEqual([]);

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await expect(page.locator('main [data-ornament="shine"]')).toBeAttached();
    expect(await endlessAnimations(page), '/').toEqual([]);
  });

  test('a text field shows the text cursor over all of its box, not only over the typing line', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    for (const name of ['Correo', 'Contraseña']) {
      const field = page.getByLabel(name, { exact: true });
      const box = (await field
        .locator('xpath=ancestor::*[@data-slot="input-wrapper"][1]')
        .boundingBox())!;
      // Near the edges and the middle of the box (the password's toggle sits at its right end).
      const xs = [
        box.x + 4,
        box.x + box.width * 0.25,
        box.x + box.width * 0.5,
        box.x + box.width * 0.75,
      ];
      const ys = [box.y + 4, box.y + box.height / 2, box.y + box.height - 4];
      const cursors = await page.evaluate(
        (points) =>
          points.map(([x, y]) => getComputedStyle(document.elementFromPoint(x!, y!)!).cursor),
        xs.flatMap((x) => ys.map((y) => [x, y]))
      );
      expect(new Set(cursors), name).toEqual(new Set(['text']));
    }
  });
});

test.describe('customer record actions', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('"Desactivar cliente" is a strong call to action: solid danger-600 red with white text (AA contrast, 6.1:1)', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();

    const disable = page.getByRole('button', { name: 'Desactivar cliente' });
    const colours = await disable.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      text: getComputedStyle(element).color,
    }));

    expect(colours.background).toBe('rgb(194, 14, 77)'); // danger-600, #c20e4d
    expect(colours.text).toBe('rgb(255, 255, 255)');
  });

  test('"Retirar" a vehicle reads as danger: red text and icon without a red background; the confirmation is solid red', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();

    const retire = page.getByRole('button', { name: /^Retirar Suzuki GSX-R600/ });
    const row = await retire.evaluate((element) => ({
      text: getComputedStyle(element).color,
      icon: getComputedStyle(element.querySelector('svg')!).color,
      background: getComputedStyle(element).backgroundColor,
    }));
    expect(row.text).toBe('rgb(194, 14, 77)'); // danger-600, #c20e4d
    expect(row.icon).toBe('rgb(194, 14, 77)');
    expect(row.background).toBe('rgba(0, 0, 0, 0)'); // no red background at rest

    await retire.click();
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Retirar', exact: true });
    expect(await confirm.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      'rgb(194, 14, 77)'
    );
    await page.keyboard.press('Escape'); // nothing is retired
  });

  test('in the vehicle form, fields side by side start at the same height even when one has help text below (in a car, Placa beside Ciudad de la placa)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: /^Editar Mazda CX-30/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar vehículo' });
    await expect(dialog.getByText('Tres letras y tres números. Ej.: ABC-123.')).toBeVisible();

    const top = async (text: string) =>
      (await dialog.getByText(text, { exact: true }).boundingBox())!.y;
    // Same row: the labels line up (1 px of rounding allowed).
    expect(Math.abs((await top('Ciudad de la placa')) - (await top('Placa')))).toBeLessThanOrEqual(
      1
    );
  });

  test('the plate is drawn yellow with black characters, a car with its city and a motorcycle with COLOMBIA (CA-27)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    const vehicles = page.getByRole('region', { name: 'Vehículos' });
    // Valentina's KDM-482 (seeds), issued in Bogotá, D.C.
    const carPlate = vehicles.getByText('KDM-482', { exact: true });
    const look = await carPlate.evaluate((characters) => {
      const plate = characters.parentElement!;
      return {
        background: getComputedStyle(plate).backgroundImage,
        ink: getComputedStyle(characters).color,
        below: plate.lastElementChild!.textContent,
      };
    });
    expect(look.background).toContain('rgb(255, 219, 61)'); // --color-plate-light, #ffdb3d
    expect(look.background).toContain('rgb(247, 198, 0)'); // --color-plate, #f7c600
    expect(look.ink).toBe('rgb(17, 17, 17)'); // --color-plate-ink, #111
    expect(look.below).toBe('BOGOTÁ, D.C.');

    // Camila's UIH-03D (seeds): the same plate, with COLOMBIA below.
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
    const motoPlate = page
      .getByRole('region', { name: 'Vehículos' })
      .getByText('UIH-03D', { exact: true });
    expect(
      await motoPlate.evaluate(
        (characters) => characters.parentElement!.lastElementChild!.textContent
      )
    ).toBe('COLOMBIA');
  });

  test('the colour list of a car (Color in the left column) opens right under the field, over the modal without being clipped, and each swatch is centred on its name', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: /^Editar Mazda CX-30/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Editar vehículo' });
    await dialog.getByRole('button', { name: /Color/ }).click();
    const listbox = page.getByRole('listbox');
    await expect(listbox.getByRole('option', { name: 'Gris' })).toBeVisible();
    await page.waitForTimeout(400); // popover animation

    // Nothing covers or clips the bottom of the open list. The list scrolls inside its own
    // viewport (the nearest scrolling ancestor): the point just above that viewport's bottom edge
    // must belong to the list (a list clipped by the modal leaves the modal's content there).
    const reachesBottom = await listbox.evaluate((element) => {
      let viewport: Element = element;
      while (
        viewport.parentElement &&
        !/(auto|scroll)/.test(getComputedStyle(viewport).overflowY)
      ) {
        viewport = viewport.parentElement;
      }
      const box = viewport.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.bottom - 6);
      return hit !== null && viewport.contains(hit);
    });
    expect(reachesBottom).toBe(true);

    // The list opens right under the field, not shifted sideways: same left edge (±1 px).
    const fieldBox = (await dialog.getByRole('button', { name: /Color/ }).boundingBox())!;
    const popoverBox = (await page
      .locator('[data-slot="content"]', { has: listbox })
      .boundingBox())!;
    expect(Math.abs(popoverBox.x - fieldBox.x)).toBeLessThanOrEqual(1);

    // Swatch and name share the same vertical centre in the options and in the chosen value.
    const offCentre = (scope: import('@playwright/test').Locator, name: string) =>
      scope.evaluate((element, colourName) => {
        const swatch = element.querySelector('[data-swatch]')!.getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && node.textContent?.trim() !== colourName) node = walker.nextNode();
        const range = document.createRange();
        range.selectNodeContents(node!);
        const text = range.getBoundingClientRect();
        return Math.abs(swatch.top + swatch.height / 2 - (text.top + text.height / 2));
      }, name);
    expect(
      await offCentre(listbox.getByRole('option', { name: 'Rojo' }), 'Rojo')
    ).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
    expect(
      await offCentre(dialog.getByRole('button', { name: /Color/ }), 'Gris')
    ).toBeLessThanOrEqual(1);

    // Any drop-down of the form behaves the same: the brand list (also in the left column).
    const brand = dialog.getByRole('combobox', { name: /Marca/ });
    await brand.click();
    await expect(page.getByRole('option', { name: 'Mazda' })).toBeVisible();
    await page.waitForTimeout(400); // popover animation
    const brandField = (await dialog
      .locator('[data-slot="input-wrapper"]', {
        has: page.getByRole('combobox', { name: /Marca/ }),
      })
      .boundingBox())!;
    const brandPopover = (await page
      .locator('[data-slot="content"]', { has: page.getByRole('listbox') })
      .boundingBox())!;
    expect(Math.abs(brandPopover.x - brandField.x)).toBeLessThanOrEqual(1);
  });

  test('every one-line radio label is optically centred on its circle (Tipo, Clase); a role card centres it on the role name (Rol)', async ({
    page,
  }) => {
    // The circle's centre against the centre of the word as drawn (capitals, lower case and accents
    // together, from their top to the baseline), not against the text's line box, which Geist's uneven vertical metrics
    // leave about half a pixel off the letters. Negative = the word sits above the circle's centre.
    const offsets = (scope: import('@playwright/test').Locator) =>
      scope.evaluate((element) =>
        [...element.querySelectorAll('input[type="radio"]')].map((input) => {
          const label = input.closest('label')!;
          const circle = input.nextElementSibling!.getBoundingClientRect();
          const text = label.querySelector('div > span')! as HTMLElement;
          const probe = document.createElement('span');
          probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
          text.appendChild(probe);
          const baseline = probe.getBoundingClientRect().top;
          probe.remove();
          const style = getComputedStyle(text);
          const context = document.createElement('canvas').getContext('2d')!;
          context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
          const ink = context.measureText(text.firstChild?.textContent ?? '');
          // Descenders (the "p" of "Operador") do not count for the eye: top of the letters to baseline.
          const inkCentre = baseline - ink.actualBoundingBoxAscent / 2;
          return {
            name: text.firstChild?.textContent,
            off: inkCentre - (circle.top + circle.height / 2),
          };
        })
      );
    const expectCentred = (list: { name?: string | null; off: number }[], count: number) => {
      expect(list.length).toBe(count);
      for (const { name, off } of list) expect(Math.abs(off), name ?? '').toBeLessThanOrEqual(0.4);
    };

    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await page.getByRole('button', { name: /^Editar Mazda CX-30/ }).click();
    const vehicleDialog = page.getByRole('dialog', { name: 'Editar vehículo' });
    await expect(vehicleDialog.getByRole('radio', { name: 'Camioneta' })).toBeAttached();
    await page.waitForTimeout(400); // modal animation
    expectCentred(await offsets(vehicleDialog), 5); // Motocicleta, Bicicleta, Carro · Automóvil, Camioneta
    await page.keyboard.press('Escape');

    // Radios with a description (invite form: Rol) are cards: the circle sits beside the role's
    // name (first line), so it is centred on that word, not on the whole card.
    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Invitar usuario' }).click();
    const inviteDialog = page.getByRole('dialog', { name: /Invitar usuario/ });
    await expect(inviteDialog.getByRole('radio').first()).toBeAttached();
    await page.waitForTimeout(400); // modal animation
    const roles = await offsets(inviteDialog);
    expectCentred(roles, 2); // Operador, Administrador
  });

  test('"Editar datos" is an icon button inside "Datos de contacto", with the hand cursor', async ({
    page,
  }) => {
    await signIn(page, SEED.admin.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.name)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();

    const edit = page
      .getByRole('region', { name: 'Datos de contacto' })
      .getByRole('button', { name: 'Editar datos' });
    await expect(edit).toBeVisible();
    expect(await edit.evaluate((element) => getComputedStyle(element).cursor)).toBe('pointer');
  });
});

test.describe('placeholders', () => {
  test('are painted in the muted zinc-500 grey, not in the colour of typed text, so an empty field does not look filled in', async ({
    page,
  }) => {
    // HeroUI paints placeholders with `foreground-500`; if the theme drops the foreground scale the
    // rule becomes invalid and the placeholder inherits the near-black text colour (#18181b).
    await page.goto('/auth/login');
    const email = page.getByPlaceholder('tu@correo.com');

    const colours = await email.evaluate((element) => ({
      placeholder: getComputedStyle(element, '::placeholder').color,
      text: getComputedStyle(element).color,
    }));

    expect(colours.placeholder).toBe('rgb(113, 113, 122)'); // zinc-500, #71717a
    expect(colours.text).toBe('rgb(24, 24, 27)'); // foreground, #18181b
  });
});
