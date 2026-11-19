/**
 * Automatic accessibility audit (spec 003, CA-04): WCAG 2.1 A/AA rules, colour contrast included,
 * on the login, the home page and user management. Serious and critical findings fail the test.
 */
import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(({ id, nodes }) => `${id}: ${nodes.map(({ target }) => target.join(' ')).join(', ')}`);
};

test('the login has no serious accessibility issues (CA-04)', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  expect(await audit(page)).toEqual([]);
});

test('home and user management have no serious accessibility issues (CA-04)', async ({ page }) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  expect(await audit(page)).toEqual([]);

  await page.goto('/admin/users');
  await expect(page.getByRole('grid')).toBeVisible();
  expect(await audit(page)).toEqual([]);
});
