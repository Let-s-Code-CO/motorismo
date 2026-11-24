// @vitest-environment node
/**
 * Every screen with data shows its shape while the data arrive (spec 011, CA-01, RF-01).
 *
 * A screen of the signed-in app is a `page.tsx` under `src/app/(app)`; its skeleton is the
 * `loading.tsx` beside it, which Next shows while the page loads. This test reads the file system
 * and fails if a screen has no `loading.tsx` (a new screen that forgot it, or one deleted by
 * mistake) or if its skeleton is not the shape the plan gives it, so a slow network never shows a
 * frozen or empty screen (the rule is in CLAUDE.md too).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import type { PageSkeletonVariant } from '@web/modules/core/components/page-skeleton.component';

const APP = join(__dirname, '../../../src/app/(app)');

/** The shape of each screen (plan 011, «Esqueletos»): the route, relative to `(app)`. */
const EXPECTED: Record<string, PageSkeletonVariant> = {
  '.': 'home',
  orders: 'list',
  'orders/[id]': 'detail',
  'orders/new': 'form',
  customers: 'list',
  'customers/[id]': 'detail',
  services: 'list',
  employees: 'list',
  'admin/users': 'list',
  profile: 'profile',
  // Spec 012: the agenda, a new reservation, a reservation and «Horario».
  agenda: 'list',
  'agenda/new': 'form',
  'agenda/[id]': 'detail',
  'agenda/schedule': 'form',
  // Spec 014: the customer's area, one column like «Mi perfil».
  my: 'profile',
  'my/history': 'list',
  'my/reservations': 'list',
  'my/reservations/new': 'form',
  'my/reservations/[id]': 'form',
  // Spec 015: «Reportes» (on its way to its one report) and the services report.
  reports: 'list',
  'reports/services': 'list',
  // Spec 016: the payroll of a month and an employee's detail.
  'reports/payroll': 'list',
  'reports/payroll/[employeeId]': 'detail',
  // Spec 017: «Mis datos» (one column, like «Mi perfil») and the admin's data requests.
  'my/data': 'profile',
  'admin/data-requests': 'list',
  'admin/data-requests/[id]': 'detail',
};

const pages = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === 'page.tsx' ? [path] : [];
  });

const routes = pages(APP)
  .map((page) => relative(APP, dirname(page)) || '.')
  .sort();

describe('every screen of the signed-in app has its loading skeleton (spec 011, CA-01)', () => {
  it('finds exactly the screens the plans list (26 today), so a new one gets its shape decided', () => {
    expect(routes).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(routes)('%s has a loading.tsx with its own shape', (route) => {
    const loading = join(APP, route, 'loading.tsx');
    expect(existsSync(loading)).toBe(true);
    expect(readFileSync(loading, 'utf8')).toContain(
      `<PageSkeleton variant="${EXPECTED[route]}" />`
    );
  });
});
