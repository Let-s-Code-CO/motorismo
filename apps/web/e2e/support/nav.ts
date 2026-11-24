import { type Page, expect } from '@playwright/test';

/**
 * Opens one of the admin's own sections from the desktop menu: they go under «Administración»
 * (spec 017).
 */
export const openAdminSection = async (page: Page, name: string) => {
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('button', { name: 'Administración' })
    .click();
  const menu = page.getByRole('menu', { name: 'Administración' });
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name }).click();
};
