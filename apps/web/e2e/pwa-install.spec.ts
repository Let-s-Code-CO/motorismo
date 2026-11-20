/**
 * Installable app (spec 006, HU-01): what the browser and Safari read to install Motorismo.
 *
 * - CA-01: anyone, even without a session, gets the manifest and the brand icons, and Chromium
 *   finds and reads the manifest without errors.
 * - CA-04: Safari gets the home-screen icon (not a screenshot) and opens the app full screen.
 * - CA-05: the system bar uses the app's colour.
 * - CA-18 / CA-19 (HU-03): on an iPhone, a signed-in person is told the app can be installed;
 *   «Instalar» shows the steps and «Ahora no» hides the notice, also after reloading. (Headless
 *   Chromium never offers to install, so the browser's own install is covered by unit tests.)
 *
 * Opening the installed app from its icon (CA-02) and the iPhone home screen (CA-04) are checked
 * by hand on real devices (tasks T055).
 */
import { expect, test } from '@playwright/test';

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
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#fafafa');
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
});
