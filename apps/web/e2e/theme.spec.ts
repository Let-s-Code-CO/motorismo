/**
 * Dark mode (spec 010) in a real browser.
 *
 * - CA-01 / RF-03: with «Sistema» on a dark device every screen is dark from the very first paint;
 *   a device that chose «Oscuro» gets it from the server's HTML.
 * - CA-02: with «Sistema», changing the device's theme while the app is open applies at once and
 *   keeps what was typed.
 * - CA-04: the plate is the same yellow in both themes.
 * - CA-05: states stay distinct in dark.
 * - CA-06: brand elements keep their look and stand out from the page.
 * - CA-07: the system bar follows the theme.
 * - CA-09 / CA-11: on a phone «Tema» lives in the account's menu; the choice survives reloading and
 *   signing out, and another device keeps its own.
 * - CA-10 / CA-13: on the desktop, the theme's own menu shows and says the chosen theme, and is used
 *   with the keyboard alone.
 * - CA-12: never chosen → «Sistema».
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains('dark'));
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const DARK_BG = 'rgb(9, 9, 11)';
const LIGHT_BG = 'rgb(250, 250, 250)';

test.describe('following the device (HU-01)', () => {
  test.use({ colorScheme: 'dark' });

  test('a dark device sees every screen dark from the first paint (CA-01, CA-12)', async ({
    page,
  }) => {
    // Checked at `domcontentloaded`: before any script of the app has run.
    await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
    expect(await isDark(page)).toBe(true);
    expect(await background(page)).toBe(DARK_BG);

    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    for (const path of ['/', '/orders', '/customers']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(await isDark(page), path).toBe(true);
      expect(await background(page), path).toBe(DARK_BG);
    }
  });

  test("a device that chose «Oscuro» gets it in the server's HTML (CA-01, CA-11)", async ({
    page,
  }) => {
    const response = await page.request.get('/auth/login', {
      headers: { cookie: 'motorismo-theme=dark' },
    });
    const html = await response.text();

    expect(html).toMatch(/<html[^>]*class="[^"]*\bdark\b/);
    expect(html).toContain('<meta name="theme-color" content="#09090b"');
  });

  test('the plate keeps its yellow and black (CA-04)', async ({ page }) => {
    const plateColours = async () => {
      await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
      await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();
      return page
        .getByRole('region', { name: 'Vehículos' })
        .getByText('UIH-03D')
        .first()
        .evaluate((element) => {
          let plate: Element | null = element;
          while (plate && !getComputedStyle(plate).backgroundImage.includes('gradient'))
            plate = plate.parentElement;
          const style = getComputedStyle(plate!);
          return { image: style.backgroundImage, ink: style.color };
        });
    };
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');

    const dark = await plateColours();
    await page.emulateMedia({ colorScheme: 'light' });
    const light = await plateColours();

    expect(dark).toEqual(light);
  });

  test('order states keep distinct colours (CA-05)', async ({ page }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.customer.email)}`);
    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.customer.name) }).click();

    const history = page
      .getByRole('heading', { name: 'Órdenes', level: 2 })
      .locator('..')
      .locator('..');
    const dotOf = (label: string) =>
      history
        .getByText(label, { exact: true })
        .first()
        .evaluate((element) => {
          const chip = element.closest('[data-slot="base"]') ?? element.parentElement!;
          const dot = chip.querySelector('[data-slot="dot"]') ?? chip.querySelector('span');
          return getComputedStyle(dot!).backgroundColor;
        });
    const colours = await Promise.all(['En proceso', 'Cerrada', 'Anulada'].map(dotOf));

    expect(new Set(colours).size).toBe(3);
  });

  test('the brand stands out from the page: «Órdenes» silver, the panel with its edge (CA-06)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/auth/login');
    const panelEdge = await page
      .getByRole('complementary', { name: 'Motorismo Detailing' })
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { width: style.borderRightWidth, colour: style.borderRightColor };
      });
    expect(panelEdge.width).toBe('1px');
    expect(panelEdge.colour).not.toBe('rgba(0, 0, 0, 0)');

    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    const orders = page.getByRole('list', { name: 'Secciones' }).getByRole('link').first();
    const image = await orders.evaluate((element) => getComputedStyle(element).backgroundImage);
    expect(image).toContain('linear-gradient');
  });

  test("changing the device's theme applies at once and keeps what was typed (CA-02)", async ({
    page,
  }) => {
    await page.goto('/auth/login');
    const email = page.getByLabel('Correo');
    await email.fill('alguien@motorismo.test');
    expect(await isDark(page)).toBe(true);

    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => isDark(page)).toBe(false);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => isDark(page)).toBe(true);

    await expect(email).toHaveValue('alguien@motorismo.test');
  });

  test('the system bar follows the theme (CA-07)', async ({ page }) => {
    await page.goto('/auth/login');
    const bar = await page.evaluate(() =>
      [...document.querySelectorAll('meta[name="theme-color"]')]
        .filter((meta) => {
          const media = meta.getAttribute('media');
          return !media || matchMedia(media).matches;
        })
        .map((meta) => meta.getAttribute('content'))
    );

    expect(bar).toEqual(['#09090b']);
  });
});

test.describe('choosing the theme on a phone (HU-02)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("«Oscuro» in the account's menu stays after reloading and signing out; another device keeps «Sistema» (CA-09, CA-11, CA-12)", async ({
    page,
    browser,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    expect(await isDark(page)).toBe(false);

    await page.getByRole('button', { name: /tu cuenta$/i }).click();
    const menu = page.getByRole('menu', { name: 'Tu cuenta' });
    await expect(menu.getByRole('menuitem', { name: /^Sistema\s*,\s*elegido$/ })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Oscuro', exact: true }).click();
    await expect.poll(() => isDark(page)).toBe(true);

    await page.reload();
    expect(await isDark(page)).toBe(true);

    await page.getByRole('button', { name: /tu cuenta$/i }).click();
    await page
      .getByRole('menu', { name: 'Tu cuenta' })
      .getByRole('menuitem', { name: 'Cerrar sesión' })
      .click();
    await expect(page).toHaveURL('/auth/login');
    expect(await isDark(page)).toBe(true);
    expect(await background(page)).toBe(DARK_BG);

    // Another device: nothing chosen there, it follows its own (light) system.
    const other = await browser.newPage();
    await other.goto('/auth/login');
    expect(await isDark(other)).toBe(false);
    expect(await background(other)).toBe(LIGHT_BG);
    await other.close();
  });
});

test.describe('choosing the theme on a desktop (HU-02)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the theme's menu shows and says the chosen one, and works with the keyboard alone (CA-10, CA-13)", async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    const button = page.getByRole('button', { name: 'Tema: Sistema' });
    await expect(button).toBeVisible();

    await button.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: /^Tema/ });
    await expect(menu.getByRole('menuitemradio', { name: 'Sistema' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    // From the chosen «Sistema», one step up is «Oscuro».
    await expect(menu.getByRole('menuitemradio', { name: 'Sistema' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');

    await expect.poll(() => isDark(page)).toBe(true);
    await expect(page.getByRole('button', { name: 'Tema: Oscuro' })).toBeVisible();
  });
});
