/**
 * Layout checks of the redesign (spec 003).
 * CA-02 no horizontal scroll on a 360 px phone (spec 004 adds sign-up, Clientes, a customer record
 * and "Mi perfil": the customer signs up from their phone; spec 005 the vehicles and their form) · CA-03 brand panel beside the form on desktop only ·
 * every clickable element shows the hand cursor (Tailwind 4 no longer sets it on buttons).
 */
import { type Page, expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

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

    await page.goto('/customers');
    await expect(page.getByRole('grid')).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();
    await expect(page.getByRole('heading', { name: SEED_CUSTOMERS.walkIn.name })).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
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
    await expect(page).toHaveURL('/profile');
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
});
