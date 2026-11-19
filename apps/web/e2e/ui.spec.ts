/**
 * Layout checks of the redesign (spec 003).
 * CA-02 no horizontal scroll on a 360 px phone · CA-03 brand panel beside the form on desktop only.
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

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
  });

  test('the login shows only the form, without the brand panel (CA-03)', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('complementary', { name: 'Motorismo Detailing' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('the login shows the brand panel beside the form (CA-03)', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByRole('complementary', { name: 'Motorismo Detailing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
});
