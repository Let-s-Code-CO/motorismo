/**
 * Transitions and loading states (spec 011) in a real browser, with the network slowed down
 * (Chrome DevTools Protocol) to see what a bad signal in the car wash shows.
 *
 * - CA-01: a screen that loads data shows its shape while the data arrive, then the content.
 * - CA-02: the skeleton only shows after 300 ms (its computed delay).
 * - CA-04: the skeleton takes the theme's colours; with «reducir movimiento» it does not pulse.
 * - CA-06: a tap on a link shows the thin bar, which goes away once the new screen is there.
 * - CA-08: with «reducir movimiento» the bar does not creep: it stays still, full width.
 * - CA-09 / CA-10: a screen's content enters with `page-in`; the header is not part of it; with
 *   «reducir movimiento» nothing moves.
 * - CA-11: going back keeps the list where it was scrolled.
 * - CA-12 / CA-14: signing in shows the brand («Entrando…») while home loads; still with
 *   «reducir movimiento».
 * - CA-13: after signing out, the sign-in page fades in.
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

/** A bad signal: every request waits and the answer trickles in. */
const slowNetwork = async (page: Page) => {
  // The app must be fully loaded (hydrated) first, as for a real user: a tap before that is a
  // plain page load, which no bar or transition is meant to cover.
  await page.waitForLoadState('networkidle');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 800,
    downloadThroughput: 30 * 1024,
    uploadThroughput: -1,
  });
  return {
    restore: () =>
      cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      }),
  };
};

const nav = (page: Page) => page.getByRole('navigation', { name: 'Navegación principal' });
const animationOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => getComputedStyle(element).animationName);

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a slow screen shows its shape and «Cargando…», then its content; the bar comes and goes (CA-01, CA-02, CA-06)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    const network = await slowNetwork(page);

    for (const [link, heading] of [
      ['Clientes', 'Clientes'],
      ['Órdenes', 'Órdenes'],
    ] as const) {
      await nav(page).getByRole('link', { name: link, exact: true }).click();
      // The tap is acknowledged at once by the bar.
      await expect(page.locator('[data-navigation-progress]')).toBeAttached();

      const skeleton = page.getByRole('status').filter({ hasText: 'Cargando…' });
      await expect(skeleton).toBeVisible();
      expect(await skeleton.evaluate((element) => getComputedStyle(element).animationDelay)).toBe(
        '0.3s'
      );
      await expect(page.locator('[data-skeleton="list"]')).toBeVisible();

      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible({
        timeout: 30_000,
      });
      await expect(skeleton).toHaveCount(0);
      await expect(page.locator('[data-navigation-progress]')).toHaveCount(0);
    }
    await network.restore();
  });

  test('a screen enters with a short fade; the header stays out of it (CA-09)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await nav(page).getByRole('link', { name: 'Servicios', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Servicios', level: 1 })).toBeVisible();

    expect(await animationOf(page, '[data-page]')).toBe('page-in');
    expect(await page.locator('[data-page] header').count()).toBe(0);
    expect(
      await page
        .locator('header')
        .first()
        .evaluate((h) => !!h.closest('[data-page]'))
    ).toBe(false);
  });

  test('going back finds the list where it was (CA-11)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    await page.goto('/orders');
    const closed = page.getByRole('list', { name: 'Órdenes cerradas' });
    await closed.scrollIntoViewIfNeeded();
    const scrolled = await page.evaluate(() => window.scrollY);
    expect(scrolled).toBeGreaterThan(100);

    await closed.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}$/);
    await page.goBack();

    await expect(closed).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 50);
    // And it stays there once the screen has settled (nothing scrolls it back to the top).
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled - 50);
  });

  test('signing in shows the brand while home loads, then home; signing out fades the sign-in page in (CA-12, CA-13)', async ({
    page,
  }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Correo').fill(SEED.operator.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(SEED.password);
    const network = await slowNetwork(page);

    await page.getByRole('button', { name: 'Entrar' }).click();

    const brand = page.getByRole('status', { name: 'Entrando…' });
    await expect(brand).toBeVisible({ timeout: 30_000 });
    await expect(brand.getByRole('img', { name: 'Logo de Motorismo Detailing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: `Hola, ${SEED.operator.name}` })).toBeVisible({
      timeout: 30_000,
    });
    await expect(brand).toHaveCount(0);
    await network.restore();

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL('/auth/login');
    expect(await animationOf(page, '[data-page]')).toBe('fade-in');
  });
});

test.describe('on a dark device with a slow network', () => {
  test.use({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });

  test("the skeleton takes the theme's colours (CA-04)", async ({ page }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    const network = await slowNetwork(page);

    await nav(page).getByRole('link', { name: 'Clientes', exact: true }).click();
    const shape = page.locator('[data-skeleton] [data-shape]').first();
    await expect(shape).toBeVisible();

    // default-200 of the dark theme: zinc-700.
    expect(await shape.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      'rgb(63, 63, 70)'
    );
    await network.restore();
  });
});

test.describe('with «reducir movimiento»', () => {
  test.use({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });

  test('nothing moves: no pulse, a still bar, no page-in (CA-04, CA-08, CA-10)', async ({
    page,
  }) => {
    await signIn(page, SEED.operator.email);
    await expect(page).toHaveURL('/');
    const network = await slowNetwork(page);

    await nav(page).getByRole('link', { name: 'Clientes', exact: true }).click();
    const bar = page.locator('[data-navigation-progress]');
    await expect(bar).toBeAttached();
    // Still and full width, instead of creeping towards 80 %.
    const width = await bar.evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBe(1280);

    await expect(page.locator('[data-skeleton] [data-shape]').first()).toBeVisible();
    expect(await animationOf(page, '[data-skeleton] [data-shape]')).toBe('none');

    await expect(page.getByRole('heading', { name: 'Clientes', level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    expect(await animationOf(page, '[data-page]')).toBe('none');
    await network.restore();
  });

  test('the brand shows still while signing in (CA-14)', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Correo').fill(SEED.operator.email);
    await page.getByLabel('Contraseña', { exact: true }).fill(SEED.password);
    const network = await slowNetwork(page);

    await page.getByRole('button', { name: 'Entrar' }).click();
    const brand = page.getByRole('status', { name: 'Entrando…' });
    await expect(brand).toBeVisible({ timeout: 30_000 });

    const moving = await brand.evaluate((element) =>
      [element, ...element.querySelectorAll('*')]
        .map((node) => getComputedStyle(node).animationName)
        .filter((name) => name !== 'none')
    );
    expect(moving).toEqual([]);
    await network.restore();
  });
});
