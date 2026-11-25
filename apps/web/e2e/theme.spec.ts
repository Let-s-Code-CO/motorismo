/**
 * Dark mode (spec 010) in a real browser.
 *
 * - CA-01 / RF-03: with «Sistema» on a dark device every screen is dark from the very first paint;
 *   a device that chose «Oscuro» gets it from the server's HTML.
 * - CA-02: with «Sistema», changing the device's theme while the app is open applies at once and
 *   keeps what was typed.
 * - CA-04: the plate is the same yellow in both themes.
 * - CA-05: states stay distinct in dark.
 * - CA-03: on dark, the focus ring of a button and the border of a focused field stand out from
 *   the background at 3:1 or more (WCAG 1.4.11; the axe audit does not measure them).
 * - CA-06: brand elements keep their look and stand out from the page (the desktop's panel and
 *   the phone's band with their edge, «Órdenes» with its relief).
 * - CA-07: the system bar follows the theme.
 * - CA-09 / CA-11: on a phone «Tema» lives in the account's menu; the choice survives reloading and
 *   signing out, and another device keeps its own.
 * - CA-10 / CA-13: on the desktop, the theme's own menu shows and says the chosen theme, and is used
 *   with the keyboard alone.
 * - CA-12: never chosen → «Sistema».
 * - After choosing a theme, the app keeps navigating: the next screen shows, with no error (the
 *   page's own `theme-color` tags are recoloured, never removed from under React).
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains('dark'));
// Spec 019: the page colour is on <html> (<body> is transparent, so the backdrop shows through).
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
const DARK_BG = 'rgb(5, 5, 6)'; // #050506, spec 019

/** WCAG contrast ratio between two `rgb(…)` colours. */
const contrast = (a: string, b: string) => {
  const luminance = (colour: string) => {
    const [r, g, bl] = (colour.match(/[\d.]+/g) ?? []).slice(0, 3).map((value) => {
      const channel = Number(value) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
};
const LIGHT_BG = 'rgb(233, 235, 239)'; // #e9ebef, the showroom grey of spec 019

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
    expect(html).toContain('<meta name="theme-color" content="#050506"');
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
    // Spec 019: «Órdenes» stands out by a silver ring and glow, with its icon and figures silver.
    const orders = page.getByRole('list', { name: 'Secciones' }).getByRole('link').first();
    // The ring is `color-mix` of the silver (#d4d4d8 = 212, 212, 216), written as `color(srgb …)`.
    const ring = await orders.evaluate((element) => {
      const [, r, g, b] =
        /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(getComputedStyle(element).boxShadow) ?? [];
      return [r, g, b].map((channel) => Math.round(Number(channel) * 255));
    });
    expect(ring).toEqual([212, 212, 216]);
  });

  test("the keyboard focus stands out on dark: a button's ring and a field's border (CA-03)", async ({
    page,
  }) => {
    await page.goto('/auth/login');

    // A field reached with the keyboard: its border against the page.
    const email = page.getByLabel('Correo');
    while (!(await email.evaluate((input) => input === document.activeElement)))
      await page.keyboard.press('Tab');
    // Polled: the border animates to its focus colour; the settled colour is what counts.
    await expect
      .poll(async () =>
        contrast(
          await email.evaluate(
            (input) => getComputedStyle(input.closest('[data-slot="input-wrapper"]')!).borderColor
          ),
          DARK_BG
        )
      )
      .toBeGreaterThanOrEqual(3);

    // A button reached with the keyboard: its focus ring (outline) against the page.
    const enter = page.getByRole('button', { name: 'Entrar' });
    while (!(await enter.evaluate((button) => button === document.activeElement)))
      await page.keyboard.press('Tab');
    const ring = () =>
      enter.evaluate((button) => {
        const style = getComputedStyle(button);
        return style.outlineStyle === 'none' ? '' : style.outlineColor;
      });
    await expect.poll(ring).not.toBe('');
    await expect.poll(async () => contrast(await ring(), DARK_BG)).toBeGreaterThanOrEqual(3);
  });

  test('on a phone, the brand band keeps its edge against the dark page (CA-06)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/auth/login');

    const edge = await page
      .getByRole('banner', { name: 'Motorismo Detailing' })
      .evaluate((band) => {
        const style = getComputedStyle(band);
        return { width: style.borderBottomWidth, colour: style.borderBottomColor };
      });

    expect(edge.width).toBe('1px');
    expect(edge.colour).not.toBe('rgba(0, 0, 0, 0)');
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

    expect(bar).toEqual(['#050506']);
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

  test('after choosing a theme, navigating still shows the next screen, with no error', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Tema: Sistema' }).click();
    await page
      .getByRole('menu', { name: /^Tema/ })
      .getByRole('menuitemradio', { name: 'Oscuro' })
      .click();
    await expect.poll(() => isDark(page)).toBe(true);

    const nav = page.getByRole('navigation', { name: 'Navegación principal' });
    for (const section of ['Órdenes', 'Clientes']) {
      await nav.getByRole('link', { name: section, exact: true }).click();
      await expect(page.getByRole('heading', { name: section, level: 1 })).toBeVisible();
      await expect(page.locator('[data-navigation-progress]')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});
