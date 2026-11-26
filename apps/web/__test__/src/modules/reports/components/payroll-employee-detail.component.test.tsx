/**
 * PayrollEmployeeDetail — how an employee's payroll of a period was reached (spec 020, CA-04; spec
 * 016, CA-11 by month).
 *
 * Guards:
 * - CA-04, RN-02: the base salary piece by piece, a fortnight (or part of one) each, with its days and
 *   its count in sight: «15 días de 30 × $ 1.300.000 = $ 650.000» by «Mes comercial», «10 días de 31 ×
 *   $ 1.300.000 = $ 419.354,84» by «Días reales»; a whole fortnight by «Mes comercial» says it counts
 *   15 days of 30 whatever its length (CA-14).
 * - Each service they took part in, with its order (which opens), date in Colombia, value, share and
 *   commission, and the count; a commission with cents keeps them (spec 016, RN-05).
 * - The base salary, the commissions and the total, as in the payroll.
 * - It names the period, says whether it is provisional, closed or a query, and with which method; it
 *   goes back to the payroll of the same period and method (CA-10).
 */
import { screen, within } from '@testing-library/react';

import PayrollEmployeeDetail from '@web/modules/reports/components/organisms/payroll-employee-detail.component';
import type {
  PayrollBasePart,
  PayrollItem,
  PayrollLine,
  PayrollQuery,
  PayrollState,
} from '@web/modules/reports/types/reports.types';

import { renderWithProviders } from '@tests/test-utils/render';

const OCTOBER_2: PayrollQuery = {
  period: { kind: 'fortnight', start: '2026-10-16' },
  method: 'actual',
};

const LINE: PayrollLine = {
  employee_id: 'e-paula',
  employee_name: 'Paula Pineda',
  active_days: 16,
  period_days: 16,
  base_salary: 1300000,
  base_pay: 650000,
  commission_pct: 40,
  commissions: 61334,
  total: 711334,
};

const part = (overrides: Partial<PayrollBasePart> = {}): PayrollBasePart => ({
  part_from: '2026-10-16',
  part_to: '2026-10-31',
  part_days: 16,
  active_days: 16,
  paid_days: 15,
  divisor: 30,
  amount: 650000,
  ...overrides,
});

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
    commission: 13334,
  }),
];

const renderDetail = ({
  query = OCTOBER_2,
  parts = [part()],
  items = ITEMS,
  state = { status: 'provisional', method: 'commercial' },
}: {
  query?: PayrollQuery;
  parts?: PayrollBasePart[];
  items?: PayrollItem[];
  state?: Pick<PayrollState, 'status' | 'method'>;
} = {}) =>
  renderWithProviders(
    <PayrollEmployeeDetail query={query} line={LINE} parts={parts} items={items} state={state} />
  );

const baseParts = () =>
  within(screen.getByRole('list', { name: 'Salario base' })).getAllByRole('listitem');

describe('PayrollEmployeeDetail', () => {
  it('names the employee and the period, and goes back to that payroll with its method (CA-10)', () => {
    renderDetail();

    expect(screen.getByRole('heading', { level: 1, name: 'Paula Pineda' })).toBeVisible();
    expect(screen.getByText('Liquidación · 2.ª quincena de octubre de 2026')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver a la liquidación' })).toHaveAttribute(
      'href',
      '/reports/payroll?fortnight=2026-10-2&base=actual'
    );
  });

  it('shows a whole fortnight by «Mes comercial» as 15 days of 30, whatever its length (CA-04, CA-14)', () => {
    renderDetail();

    const [whole] = baseParts();
    expect(whole).toHaveTextContent('Del 16 al 31 de octubre de 2026 · activo 16 de 16 días');
    expect(whole).toHaveTextContent('15 días de 30 × $ 1.300.000 = $ 650.000');
    expect(whole).toHaveTextContent('Quincena completa: cuenta 15 días de 30.');
  });

  it('shows part of a fortnight by «Días reales» with its count, cents kept (CA-04, CA-15)', () => {
    // 1 300 000 × 10 ÷ 31 = 419 354.838…
    renderDetail({
      parts: [part({ active_days: 10, paid_days: 10, divisor: 31, amount: 419354.8387 })],
      state: { status: 'provisional', method: 'actual' },
    });

    const [partial] = baseParts();
    expect(partial).toHaveTextContent('activo 10 de 16 días');
    expect(partial).toHaveTextContent('10 días de 31 × $ 1.300.000 = $ 419.354,84');
    expect(partial).not.toHaveTextContent('Quincena completa');
  });

  it('shows a range a piece per fortnight it touches (CA-04, RN-02)', () => {
    renderDetail({
      query: { period: { kind: 'range', from: '2026-11-03', to: '2026-11-20' }, method: null },
      parts: [
        part({
          part_from: '2026-11-03',
          part_to: '2026-11-15',
          part_days: 13,
          active_days: 13,
          paid_days: 13,
          amount: 563333.3333,
        }),
        part({
          part_from: '2026-11-16',
          part_to: '2026-11-20',
          part_days: 5,
          active_days: 5,
          paid_days: 5,
          amount: 216666.6667,
        }),
      ],
      state: { status: 'query', method: 'commercial' },
    });

    const parts = baseParts();
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveTextContent('Del 3 al 15 de noviembre de 2026');
    expect(parts[1]).toHaveTextContent('Del 16 al 20 de noviembre de 2026');
    expect(parts[1]).toHaveTextContent('5 días de 30 × $ 1.300.000 = $ 216.666,67');
  });

  it('lists each service with its order, date in Colombia and the count of its commission (CA-04)', () => {
    renderDetail();

    const services = within(
      screen.getByRole('list', { name: 'Comisiones del periodo' })
    ).getAllByRole('listitem');
    expect(services).toHaveLength(2);
    expect(services[0]).toHaveTextContent('Micropulido');
    expect(services[0]).toHaveTextContent('31/10/2026');
    expect(services[0]).toHaveTextContent('$ 120.000 × 100 % × 40 % = $ 48.000');
    expect(within(services[0]!).getByRole('link', { name: 'Orden #2' })).toHaveAttribute(
      'href',
      '/orders/o2'
    );
  });

  it('keeps the cents of a commission, as it was computed (spec 016, RN-05)', () => {
    renderDetail({ items: [item({ price: 33335, share_pct: 75, commission: 10000.5 })] });

    expect(screen.getByText('$ 33.335 × 75 % × 40 % = $ 10.000,5')).toBeVisible();
  });

  it('ends with the base salary, the commissions and the total (CA-01)', () => {
    renderDetail();

    const totals = screen.getByLabelText('Totales de Paula Pineda');
    const pairs = within(totals)
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(pairs).toEqual([
      ['Salario base', '$ 650.000'],
      ['Comisiones', '$ 61.334'],
      ['Total', '$ 711.334'],
    ]);
  });

  it.each([
    ['provisional', 'Provisional'],
    ['closed', 'Cerrada'],
    ['query', 'Consulta'],
  ] as const)(
    'says a %s payroll is «%s», and its method (CA-05, CA-08, CA-16)',
    (status, label) => {
      renderDetail({ state: { status, method: 'actual' } });

      expect(screen.getByText(label)).toBeVisible();
      expect(screen.getByText('Salario base por «Días reales».')).toBeVisible();
    }
  );

  it('says when they took part in no service in the period (CA-04)', () => {
    renderDetail({ items: [] });

    expect(screen.getByText('No participó en servicios en este periodo.')).toBeVisible();
  });
});
