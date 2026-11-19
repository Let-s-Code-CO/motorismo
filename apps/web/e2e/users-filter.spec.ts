/**
 * Filtering users from the summary (spec 003, CA-09). Counts change while other specs run, so
 * cards are found by their label and rows by seed users that never change status.
 */
import { expect, test } from '@playwright/test';

import { SEED, signIn } from './support/sandbox';

test('the summary filters the list, survives a reload and "Ver todos" resets it (CA-09)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/admin/users');

  const row = (name: string) => page.getByRole('row', { name: new RegExp(name) });
  const disabledCard = page.getByRole('button', { name: /^Desactivados \d+$/ });

  await disabledCard.click();
  await expect(page).toHaveURL('/admin/users?status=disabled');
  await expect(disabledCard).toHaveAttribute('aria-pressed', 'true');
  await expect(row(SEED.disabled.name)).toBeVisible();
  await expect(row(SEED.operator.name)).toHaveCount(0);

  await page.reload();
  await expect(row(SEED.disabled.name)).toBeVisible();
  await expect(row(SEED.operator.name)).toHaveCount(0);

  await page.getByRole('button', { name: 'Ver todos' }).click();
  await expect(page).toHaveURL('/admin/users');
  await expect(row(SEED.operator.name)).toBeVisible();
  await expect(row(SEED.disabled.name)).toBeVisible();
});
