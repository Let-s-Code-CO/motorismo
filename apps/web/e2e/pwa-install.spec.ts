/**
 * Installable app (spec 006, HU-01): what the browser and Safari read to install Motorismo.
 *
 * - CA-01: anyone, even without a session, gets the manifest and the brand icons, and Chromium
 *   finds and reads the manifest without errors.
 * - CA-04: Safari gets the home-screen icon (not a screenshot) and opens the app full screen.
 * - CA-05: the system bar uses the app's colour.
 * - CA-18 / CA-19 (HU-03): on an iPhone, a signed-in person is told the app can be installed;
 *   «Instalar» shows the steps and «Ahora no» hides the notice, also after reloading. The notice
 *   never covers the end of a page: scrolled to the bottom, the last thing on it can be tapped (a
 *   destructive action like «Anular orden» lives there, spec 008). In dark mode too, nothing under
 *   it shows through: its background is opaque. (Headless
 *   Chromium never offers to install, so the browser's own install is covered by unit tests.)
 *
 * Opening the installed app from its icon (CA-02) and the iPhone home screen (CA-04) are checked
 * by hand on real devices (tasks T055).
 */
import { expect, test } from '@playwright/test';

import { floatsOpaque } from './support/banners';
import { SEED_CUSTOMERS, signIn } from './support/sandbox';

test.describe('installable app (spec 006, HU-01)', () => {
  test('serves the manifest and its icons without a session (CA-01)', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/manifest+json');

    const manifest = (await response.json()) as { name: string; icons: { src: string }[] };
    expect(manifest.name).toBe('Motorismo Detailing');
    for (const icon of manifest.icons) {
      const image = await request.get(icon.src);
      expect(image.status(), icon.src).toBe(200);
      expect(image.headers()['content-type']).toBe('image/png');
    }
  });

  test('declares the manifest, the Safari home-screen icon and the theme colour (CA-01, CA-04, CA-05)', async ({
    page,
    request,
  }) => {
    await page.goto('/auth/login');

    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      '/manifest.webmanifest'
    );
    // A light device sees the light background as its system bar (spec 010 adds the dark one).
    await expect(
      page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')
    ).toHaveAttribute('content', '#fafafa');
    await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
      'content',
      'yes'
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
      'content',
      'Motorismo'
    );

    const appleIcon = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIcon).toHaveAttribute('sizes', '180x180');
    const href = await appleIcon.getAttribute('href');
    const image = await request.get(href!);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/png');
  });

  test('Chromium finds and reads the manifest without errors (CA-01)', async ({ page }) => {
    await page.goto('/auth/login');
    const cdp = await page.context().newCDPSession(page);

    // The manifest loads after the page: poll until Chromium has read it. (Headless Chromium
    // reports no installability errors at all, so that call proves nothing here; the icons are
    // checked by the first test.)
    await expect
      .poll(
        async () => {
          const { url, errors } = await cdp.send('Page.getAppManifest');
          return { url: url.replace(/^https?:\/\/[^/]+/, ''), errors: errors.length };
        },
        { timeout: 15_000 }
      )
      .toEqual({ url: '/manifest.webmanifest', errors: 0 });
  });
});

test.describe('the install notice on an iPhone (spec 006, HU-03)', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  });

  test('tells a signed-in person the app can be installed; «Instalar» shows the steps and «Ahora no» hides it (CA-18, CA-19)', async ({
    page,
  }) => {
    await signIn(page, SEED_CUSTOMERS.customer.email);
    const notice = page.getByText('Instala Motorismo en este dispositivo');
    await expect(notice).toBeVisible();

    await page.getByRole('button', { name: 'Instalar', exact: true }).click();
    const steps = page.getByRole('dialog', { name: 'Instalar Motorismo en tu iPhone o iPad' });
    await expect(steps).toContainText('Elige «Agregar a inicio».');
    await steps.getByRole('button', { name: 'Entendido' }).click();

    await page.getByRole('button', { name: 'Ahora no' }).click();
    await expect(notice).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Instalar app' })).toBeVisible();
    await expect(notice).toHaveCount(0);
  });

  test('never covers the end of the page: scrolled to the bottom, the footer can be tapped (CA-18)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, SEED_CUSTOMERS.customer.email);
    await expect(page.getByText('Instala Motorismo en este dispositivo')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    // What a finger would hit at the centre of the footer is the footer itself, not the notice.
    const hit = await page.locator('footer').evaluate((footer) => {
      const box = footer.getBoundingClientRect();
      const found = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return Boolean(found && footer.contains(found));
    });
    expect(hit).toBe(true);
  });
});

test.describe('the install notice on an iPhone, in dark mode (spec 006, HU-03; spec 010)', () => {
  test.use({
    colorScheme: 'dark',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  });

  test('is opaque: the page under it never shows through (CA-18)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, SEED_CUSTOMERS.customer.email);
    const notice = page.getByText('Instala Motorismo en este dispositivo');
    await expect(notice).toBeVisible();

    expect(await floatsOpaque(notice)).toBe(true);
  });
});
