/**
 * Staff consult customers (spec 004, HU-04).
 *
 * Guards CA-15 (newest first, with name, email, phone, status and date), CA-16 (search by part of
 * the name/email/phone, ignoring case and accents, with an explicit "no match"), CA-17 (summary
 * cards filter the list per the project standard, combined with the search, also when a card is
 * pressed while the search still waits), CA-18 (the record)
 * and CA-19 (an unconfirmed sign-up is not a customer). Seeds never change, so they anchor rows.
 */
import { expect, test } from '@playwright/test';

import {
  SEED,
  SEED_CUSTOMERS,
  adminClient,
  deleteUsersByEmail,
  publicClient,
  signIn,
  uniqueEmail,
} from './support/sandbox';

const older = uniqueEmail('older');
const newer = uniqueEmail('newer');
const unconfirmed = uniqueEmail('unconfirmed');
// Each parallel worker creates its own pair, so the names carry a tag of their own.
const tag = `T${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

test.beforeAll(async () => {
  const { data: admin } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('email', SEED.admin.email)
    .single();
  const inOrder: [string, string][] = [
    [older, `Orden Antiguo ${tag}`],
    [newer, `Orden Reciente ${tag}`],
  ];
  for (const [email, full_name] of inOrder) {
    await adminClient()
      .from('customers')
      .insert({ full_name, email, origin: 'counter', registered_by: admin!.id });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await publicClient().auth.signUp({
    email: unconfirmed,
    password: 'cliente-nuevo-1',
    options: { data: { full_name: 'Sin Confirmar', data_consent: true } },
  });
});
test.afterAll(() => deleteUsersByEmail([older, newer, unconfirmed]));

const rows = (page: import('@playwright/test').Page) =>
  page.getByRole('grid', { name: 'Clientes del negocio' }).getByRole('row');

test('lists customers newest first with name, email, phone, status and date (CA-15)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Clientes' })
    .click();
  await expect(page).toHaveURL('/customers');
  await expect(page.getByRole('heading', { name: 'Clientes' })).toBeVisible();

  await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill(tag);
  await expect(page).toHaveURL(`/customers?q=${tag}`);
  await expect(rows(page).nth(1)).toContainText('Orden Reciente');
  await expect(rows(page).nth(2)).toContainText('Orden Antiguo');
  // The date of registration, as the app shows it (Colombian time).
  const today = new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeZone: 'America/Bogota',
  }).format(new Date());
  await expect(rows(page).nth(1)).toContainText(today);

  await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill(SEED_CUSTOMERS.walkIn.email);
  const row = page.getByRole('row', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) });
  await expect(row).toContainText(SEED_CUSTOMERS.walkIn.email);
  await expect(row).toContainText(SEED_CUSTOMERS.walkIn.phone);
  await expect(row).toContainText('Sin cuenta');
});

test('searches ignoring case and accents, and says when nothing matches (CA-16, CA-19)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  const search = page.getByRole('searchbox', { name: 'Buscar clientes' });

  await search.fill('VALENTINA vasquez');
  await expect(
    page.getByRole('row', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) })
  ).toBeVisible();
  await expect(rows(page)).toHaveCount(2); // header + one customer

  await search.fill('9998877');
  await expect(
    page.getByRole('row', { name: new RegExp(SEED_CUSTOMERS.phoneOnly.name) })
  ).toBeVisible();

  await search.fill(unconfirmed);
  await expect(page.getByText('No hay clientes que coincidan con tu búsqueda.')).toBeVisible();
});

test('the summary cards filter, combine with the search, survive a reload and reset (CA-17)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  const walkInCard = page.getByRole('button', { name: /^Sin cuenta \d+$/ });
  const row = (name: string) => page.getByRole('row', { name: new RegExp(name) });

  await walkInCard.click();
  await expect(page).toHaveURL('/customers?status=walk_in');
  await expect(walkInCard).toHaveAttribute('aria-pressed', 'true');
  await expect(row(SEED_CUSTOMERS.walkIn.name)).toBeVisible();
  await expect(row(SEED_CUSTOMERS.customer.name)).toHaveCount(0);

  await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill('andres');
  await expect(page).toHaveURL('/customers?q=andres&status=walk_in');
  await expect(row(SEED_CUSTOMERS.phoneOnly.name)).toBeVisible();
  await expect(row(SEED_CUSTOMERS.walkIn.name)).toHaveCount(0);
  await expect(page.getByText(/^1 de \d+ clientes · Sin cuenta · «andres»$/)).toBeVisible();

  await page.reload();
  await expect(row(SEED_CUSTOMERS.phoneOnly.name)).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Buscar clientes' })).toHaveValue('andres');

  await page.getByRole('button', { name: 'Ver todos' }).click();
  await expect(page).toHaveURL('/customers');
  await expect(row(SEED_CUSTOMERS.customer.name)).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Buscar clientes' })).toHaveValue('');
});

test('a card pressed while the search still waits keeps both: the search does not undo the card (CA-16, CA-17)', async ({
  page,
}) => {
  await signIn(page, SEED.admin.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  await page.waitForLoadState('networkidle');
  const walkInCard = page.getByRole('button', { name: /^Sin cuenta \d+$/ });

  // Typed and pressed at once: the card goes out well before the search's 300 ms wait ends.
  await page.getByRole('searchbox', { name: 'Buscar clientes' }).fill('andres');
  await walkInCard.click();

  await expect(page).toHaveURL('/customers?q=andres&status=walk_in');
  await expect(walkInCard).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('searchbox', { name: 'Buscar clientes' })).toHaveValue('andres');
  await expect(
    page.getByRole('row', { name: new RegExp(SEED_CUSTOMERS.phoneOnly.name) })
  ).toBeVisible();
});

test('"Activos" shows customers with and without account, but not the disabled ones (CA-17)', async ({
  page,
}) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto('/customers');
  const row = (name: string) => page.getByRole('row', { name: new RegExp(name) });

  await page.getByRole('button', { name: /^Activos \d+$/ }).click();

  await expect(page).toHaveURL('/customers?status=active');
  await expect(row(SEED_CUSTOMERS.customer.name)).toBeVisible();
  await expect(row(SEED_CUSTOMERS.walkIn.name)).toBeVisible();
  await expect(row(SEED_CUSTOMERS.disabled.name)).toHaveCount(0);
});

test('opens the record of a counter customer (CA-18)', async ({ page }) => {
  await signIn(page, SEED.operator.email);
  await expect(page).toHaveURL('/');
  await page.goto(`/customers?q=${encodeURIComponent(SEED_CUSTOMERS.walkIn.email)}`);

  await page.getByRole('link', { name: new RegExp(SEED_CUSTOMERS.walkIn.name) }).click();

  await expect(page.getByRole('heading', { name: SEED_CUSTOMERS.walkIn.name })).toBeVisible();
  await expect(page.getByText(SEED_CUSTOMERS.walkIn.email)).toBeVisible();
  await expect(page.getByText(SEED_CUSTOMERS.walkIn.phone)).toBeVisible();
  await expect(page.getByText('Punto de atención')).toBeVisible();
  await expect(page.getByText(SEED.admin.name)).toBeVisible(); // registered by
  await expect(page.getByText('Autorizó el tratamiento de datos')).toBeVisible();
});
