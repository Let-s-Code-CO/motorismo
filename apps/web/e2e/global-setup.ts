/**
 * Warms the local dev server up before the E2E run: visits every screen once, as an admin and as a
 * customer, so that `pnpm dev` has compiled them all before the tests run in parallel.
 *
 * Why: the dev server compiles a route the first time it is requested. With several workers asking
 * for new screens at once, those first visits took longer than the tests wait (a sign-in that did
 * not reach «Inicio» in 10 s, a list that did not refresh in time), and a whole run rarely came out
 * clean. In CI the tests run against the production build, which needs no warming up.
 */
import { type FullConfig, type Page, chromium } from '@playwright/test';

import { SEED, SEED_CUSTOMERS, adminClient, signIn } from './support/sandbox';

/** A first compile can take a while: wait for it rather than fail the setup. */
const COMPILE_TIMEOUT = 120_000;

const visitAll = async (page: Page, paths: string[]) => {
  for (const path of paths) {
    await page.goto(path, { timeout: COMPILE_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: COMPILE_TIMEOUT });
  }
};

const signedIn = async (page: Page, email: string, home: string) => {
  await signIn(page, email);
  await page.waitForURL(home, { timeout: COMPILE_TIMEOUT });
};

const globalSetup = async (config: FullConfig) => {
  if (process.env.CI) return;
  const baseURL = config.projects[0]!.use.baseURL!;

  // Ids of the seeds, for the screens of one record.
  const admin = adminClient();
  const [order, reservation, customer, employee, request] = await Promise.all([
    admin.from('work_orders').select('id').limit(1).single(),
    admin.from('reservations').select('id').limit(1).single(),
    admin.from('customers').select('id').eq('email', SEED_CUSTOMERS.customer.email).single(),
    admin.from('employees').select('id').limit(1).single(),
    admin.from('data_requests').select('id').limit(1).single(),
  ]);
  const own = await admin
    .from('reservations')
    .select('id')
    .eq('customer_id', customer.data!.id)
    .limit(1)
    .maybeSingle();

  const browser = await chromium.launch();
  try {
    const visitor = await browser.newPage({ baseURL });
    await visitAll(visitor, [
      '/auth/login',
      '/auth/sign-up',
      '/auth/forgot-password',
      '/auth/invalid-link',
      '/privacy',
    ]);
    await visitor.close();

    const staff = await browser.newPage({ baseURL });
    await signedIn(staff, SEED.admin.email, '/');
    await visitAll(staff, [
      '/orders',
      '/orders/new',
      `/orders/${order.data!.id}`,
      '/agenda',
      '/agenda/new',
      '/agenda/schedule',
      `/agenda/${reservation.data!.id}`,
      '/customers',
      `/customers/${customer.data!.id}`,
      '/services',
      '/employees',
      '/reports/services',
      '/reports/payroll',
      `/reports/payroll/${employee.data!.id}`,
      '/admin/users',
      '/admin/vehicle-catalog',
      '/admin/vehicle-catalog/plate-cities',
      '/admin/data-requests',
      `/admin/data-requests/${request.data!.id}`,
      '/profile',
    ]);
    await staff.close();

    const client = await browser.newPage({ baseURL });
    await signedIn(client, SEED_CUSTOMERS.customer.email, '/my');
    await visitAll(client, [
      '/my/history',
      '/my/reservations',
      '/my/reservations/new',
      ...(own.data ? [`/my/reservations/${own.data.id}`] : []),
      '/my/data',
    ]);
    await client.close();
  } finally {
    await browser.close();
  }
};

export default globalSetup;
