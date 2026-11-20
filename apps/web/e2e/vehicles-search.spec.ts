/**
 * Finding a customer by the plate of the vehicle that arrives (spec 005, HU-04).
 *
 * Guards CA-17 (a whole or partial plate, with or without hyphen, in any case, finds the owner),
 * CA-18 (a retired plate no longer finds its former owner) and CA-19 (the row shows the plate that
 * matched, compact: one line without "COLOMBIA", CA-29). Uses the seeds: Camila has UIH-03D active
 * and JWJ-07 retired.
 */
import { expect, test } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, signIn } from './support/sandbox';

const CAMILA = SEED_CUSTOMERS.customer.name;

test('finds the owner by the plate written any way, and shows it (CA-17, CA-19)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  const search = page.getByRole('searchbox', { name: 'Buscar clientes' });
  const camila = page.getByRole('row', { name: new RegExp(CAMILA) });

  for (const typed of ['uih03', 'UIH-03', 'uih 03d']) {
    await search.fill(typed);
    // The search reaches the URL after a short pause; wait for it before reading the list.
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(typed);
    await expect(camila).toBeVisible();
    await expect(camila).toContainText('UIH-03D');
    // CA-29: in the table the plate is compact — one line, no "COLOMBIA".
    await expect(camila).not.toContainText('COLOMBIA');
    await expect(page.getByRole('grid').getByRole('row')).toHaveCount(2); // header + Camila
  }

  // It combines with the summary cards (spec 004, CA-17): Camila has an account.
  await page.getByRole('button', { name: /^Con cuenta \d+$/ }).click();
  await expect(page).toHaveURL(/status=registered/);
  await expect(camila).toBeVisible();
  await page.getByRole('button', { name: /^Sin cuenta \d+$/ }).click();
  await expect(page).toHaveURL(/status=walk_in/);
  await expect(camila).toHaveCount(0);
});

test('a retired plate no longer finds its former owner (CA-18)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');

  await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill('JWJ-07');

  await expect(page.getByText('No hay clientes que coincidan con tu búsqueda.')).toBeVisible();
});
