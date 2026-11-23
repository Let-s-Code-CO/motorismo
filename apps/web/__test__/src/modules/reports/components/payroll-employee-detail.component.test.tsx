/**
 * PayrollEmployeeDetail — how an employee's payroll of a month was reached (spec 016, CA-11).
 *
 * Guards:
 * - CA-09: the base salary of the month with its count in sight: «15 de 31 días de $ 1.300.000 =
 *   $ 629.032» (1 300 000 × 15 ÷ 31 = 629 032.26 → 629 032).
 * - CA-06 / CA-11: each service they took part in, with its order (which opens), date in Colombia,
 *   value, share and commission, and the count: «$ 120.000 × 100 % × 40 % = $ 48.000»; a
 *   commission with cents keeps them («$ 10.000,5»).
 * - RN-05: commissions, base of the month and total, as in the payroll.
 * - CA-12 / CA-15: it says whether the month is provisional or closed; back to the payroll of the
 *   same month.
 * - A month without services for them says so.
 */
import { screen, within } from '@testing-library/react';

import PayrollEmployeeDetail from '@web/modules/reports/components/organisms/payroll-employee-detail.component';
import type { PayrollItem, PayrollLine } from '@web/modules/reports/types/reports.types';

import { renderWithProviders } from '@tests/test-utils/render';

const LINE: PayrollLine = {
  employee_id: 'e-paula',
  employee_name: 'Paula Pineda',
  active_days: 15,
  month_days: 31,
  base_salary: 1300000,
  base_pay: 629032,
  commission_pct: 40,
  commissions: 61334,
  total: 690366,
};

const item = (overrides: Partial<PayrollItem> = {}): PayrollItem => ({
  order_id: 'o2',
  order_number: 2,
  // 31 Oct at 11:30 p. m. in Bogotá: 1 Nov in UTC.
  closed_at: '2026-11-01T04:30:00Z',
  service_name: 'Micropulido',
  price: 120000,
  share_pct: 100,
  commission: 48000,
  ...overrides,
});

const ITEMS = [
  item(),
  item({
    order_id: 'o5',
    order_number: 5,
    closed_at: '2026-10-20T15:00:00Z',
    service_name: 'Cadena',
    price: 33335,
    share_pct: 100,
    commission: 13334,
  }),
];

const renderDetail = ({
  items = ITEMS,
  status = 'provisional' as const,
}: { items?: PayrollItem[]; status?: 'provisional' | 'closed' } = {}) =>
  renderWithProviders(
    <PayrollEmployeeDetail month="2026-10" line={LINE} items={items} status={status} />
  );

describe('PayrollEmployeeDetail', () => {
  it('names the employee and the month, and goes back to that payroll (CA-11)', () => {
    renderDetail();

    expect(screen.getByRole('heading', { level: 1, name: 'Paula Pineda' })).toBeVisible();
    expect(screen.getByText('Liquidación de octubre de 2026')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver a la liquidación' })).toHaveAttribute(
      'href',
      '/reports/payroll?month=2026-10'
    );
  });

  it('shows how the base salary of the month was reached (CA-09)', () => {
    renderDetail();

    expect(screen.getByText('15 de 31 días de $ 1.300.000 = $ 629.032')).toBeVisible();
  });

  it('lists each service with its order, date in Colombia and the count of its commission (CA-06, CA-11)', () => {
    renderDetail();

    const services = within(screen.getByRole('list', { name: 'Comisiones del mes' })).getAllByRole(
      'listitem'
    );
    expect(services).toHaveLength(2);
    expect(services[0]).toHaveTextContent('Micropulido');
    expect(services[0]).toHaveTextContent('31/10/2026');
    expect(services[0]).toHaveTextContent('$ 120.000 × 100 % × 40 % = $ 48.000');
    expect(within(services[0]!).getByRole('link', { name: 'Orden #2' })).toHaveAttribute(
      'href',
      '/orders/o2'
    );
  });

  it('keeps the cents of a commission, as it was computed (RN-05)', () => {
    renderDetail({ items: [item({ price: 33335, share_pct: 75, commission: 10000.5 })] });

    expect(screen.getByText('$ 33.335 × 75 % × 40 % = $ 10.000,5')).toBeVisible();
  });

  it('ends with the base of the month, the commissions and the total (CA-05, RN-05)', () => {
    renderDetail();

    const totals = screen.getByLabelText('Totales de Paula Pineda');
    const pairs = within(totals)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(pairs).toEqual([
      ['Salario del mes', '$ 629.032'],
      ['Comisiones', '$ 61.334'],
      ['Total', '$ 690.366'],
    ]);
  });

  it('says whether the month is provisional or closed (CA-12, CA-15)', () => {
    const { unmount } = renderDetail();
    expect(screen.getByText('Provisional')).toBeVisible();
    unmount();

    renderDetail({ status: 'closed' });
    expect(screen.getByText('Cerrada')).toBeVisible();
  });

  it('says when they took part in no service this month (CA-11)', () => {
    renderDetail({ items: [] });

    expect(screen.getByText('No participó en servicios este mes.')).toBeVisible();
  });
});
