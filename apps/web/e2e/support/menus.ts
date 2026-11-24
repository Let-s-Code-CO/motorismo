import { type Locator, type Page, expect } from '@playwright/test';

/**
 * Opens a row's actions menu («Acciones de …») and picks an item, retrying while the list is
 * rendered again: a refresh while the menu is open detaches it («element is not stable» or
 * «detached»), and a person would simply open it again.
 */
export const chooseRowAction = async (
  page: Page,
  name: string,
  item: string,
  within: Locator | Page = page
) => {
  await expect(async () => {
    await within.getByRole('button', { name: `Acciones de ${name}` }).click({ timeout: 2_000 });
    await page.getByRole('menuitem', { name: item }).click({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
};
