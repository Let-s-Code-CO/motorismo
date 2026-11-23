/**
 * ServicesReportScreen — «Reportes» → «Servicios»: the services of the closed orders, for the admin
 * (spec 015, HU-01 and HU-02).
 *
 * Guards:
 * - CA-01: each service says its closing date, order number, customer, vehicle and plate, service,
 *   value and the employees with their share. A table on the desktop and a card per service on a
 *   phone (both are drawn; the CSS shows one: e2e/ui.spec.ts checks the phone).
 * - CA-10: each service opens its order.
 * - CA-06, RN-03: at the end, how many and their sum; the discounts and the total too, except with
 *   an employee filter, which says why.
 * - CA-08: with no services, it says so and offers «Quitar filtros» (only when there are filters
 *   other than this month).
 * - CA-11: pages of 50, with the same filters; the totals are those of the whole filter.
 * - CA-12: «Exportar a Excel» downloads with the same filters.
 */
import { screen, within } from '@testing-library/react';

import ServicesReportScreen from '@web/modules/reports/components/organisms/services-report-screen.component';
import type {
  ReportFilters,
  ServiceReportRow,
  ServiceReportTotals,
} from '@web/modules/reports/types/reports.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const ELKIN = '6f1d2c3b-4a59-4e8f-9b0a-1c2d3e4f5a6b';
const THIS_MONTH = { from: '2026-11-01', to: '2026-11-23' };

const filters = (overrides: Partial<ReportFilters> = {}): ReportFilters => ({
  ...THIS_MONTH,
  employee: null,
  plate: '',
  page: 1,
  ...overrides,
});

const row = (overrides: Partial<ServiceReportRow> = {}): ServiceReportRow => ({
  line_id: 'l1',
  order_id: 'o2',
  order_number: 2,
  // 30 Nov at 11:30 p. m. in Bogotá: still the 30th.
  closed_at: '2026-12-01T04:30:00Z',
  customer_name: 'Camila Cliente',
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
  service_name: 'Lavado detallado',
  price: 40000,
  employees: [
    { name: 'Elkin Estrada', share: 50 },
    { name: 'Paula Pineda', share: 50 },
  ],
  ...overrides,
});

const totals = (overrides: Partial<ServiceReportTotals> = {}): ServiceReportTotals => ({
  services: 2,
  subtotal: 160000,
  discounts: 5000,
  total: 155000,
  ...overrides,
});

const renderScreen = ({
  state = filters(),
  rows = [row(), row({ line_id: 'l2', service_name: 'Micropulido', price: 120000 })],
  sums = totals(),
}: { state?: ReportFilters; rows?: ServiceReportRow[]; sums?: ServiceReportTotals } = {}) =>
  renderWithProviders(
    <ServicesReportScreen
      filters={state}
      rows={rows}
      totals={sums}
      employees={[]}
      defaultPeriod={THIS_MONTH}
    />
  );

const table = () => screen.getByRole('table', { name: 'Servicios hechos' });
const cards = () => screen.getByRole('list', { name: 'Servicios hechos' });
const totalsOf = () => {
  const list = screen.getByLabelText('Totales');
  return within(list)
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);
};

describe('ServicesReportScreen', () => {
  it('titles the report', () => {
    renderScreen();

    expect(screen.getByRole('heading', { level: 1, name: 'Reporte de servicios' })).toBeVisible();
  });

  it('shows in the table each field of a service, with its closing day in Colombia (CA-01)', () => {
    renderScreen();

    const headers = within(table())
      .getAllByRole('columnheader')
      .map((header) => header.textContent);
    expect(headers).toEqual([
      'Fecha',
      'Orden',
      'Cliente',
      'Vehículo',
      'Servicio',
      'Valor',
      'Empleados',
    ]);
    const [first] = within(table()).getAllByRole('row').slice(1);
    expect(
      within(first!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    ).toEqual([
      '30/11/2026',
      '#2',
      'Camila Cliente',
      'Suzuki GSX-R600 · UIH-03D',
      'Lavado detallado',
      '$ 40.000',
      'Elkin Estrada 50 % · Paula Pineda 50 %',
    ]);
  });

  it('says «Sin placa» for a vehicle without one and «Sin empleados» for a service without them', () => {
    renderScreen({
      rows: [
        row({
          vehicle_type: 'bicycle',
          brand_name: 'Specialized',
          line_name: null,
          plate: null,
          employees: [],
        }),
      ],
    });

    const [first] = within(table()).getAllByRole('row').slice(1);
    expect(within(first!).getByText('Specialized · Sin placa')).toBeInTheDocument();
    expect(within(first!).getByText('Sin empleados')).toBeInTheDocument();
  });

  it('opens its order from each service, in the table and on the cards (CA-10)', () => {
    renderScreen();

    const [first] = within(table()).getAllByRole('row').slice(1);
    expect(within(first!).getByRole('link', { name: /Orden #2/ })).toHaveAttribute(
      'href',
      '/orders/o2'
    );
    const [card] = within(cards()).getAllByRole('listitem');
    expect(within(card!).getByRole('link')).toHaveAttribute('href', '/orders/o2');
  });

  it('shows on each card the same fields as the table (CA-01, phone)', () => {
    renderScreen();

    const [card] = within(cards()).getAllByRole('listitem');
    for (const text of [
      '30/11/2026',
      'Lavado detallado',
      'Camila Cliente',
      'Suzuki GSX-R600 · UIH-03D',
      '$ 40.000',
      'Elkin Estrada 50 % · Paula Pineda 50 %',
    ]) {
      expect(within(card!).getByText(text, { exact: false })).toBeInTheDocument();
    }
  });

  it('ends with how many, their sum, the discounts and the total (CA-06)', () => {
    renderScreen();

    expect(totalsOf()).toEqual([
      ['Servicios', '2'],
      ['Suma de valores', '$ 160.000'],
      ['Descuentos', '− $ 5.000'],
      ['Total', '$ 155.000'],
    ]);
  });

  it('with an employee filter, gives only how many and their sum, and says why (CA-06, RN-03)', () => {
    renderScreen({
      state: filters({ employee: ELKIN }),
      sums: totals({ discounts: null, total: null }),
    });

    expect(totalsOf()).toEqual([
      ['Servicios', '2'],
      ['Suma de valores', '$ 160.000'],
    ]);
    expect(
      screen.getByText(
        'Con un empleado elegido no se muestran descuentos ni total: el descuento es de la orden completa.'
      )
    ).toBeVisible();
  });

  it('downloads the Excel with the same filters (CA-12)', () => {
    renderScreen({ state: filters({ plate: 'UIH03D', page: 2 }) });

    expect(screen.getByRole('link', { name: 'Exportar a Excel' })).toHaveAttribute(
      'href',
      '/reports/services/export?from=2026-11-01&to=2026-11-23&plate=UIH03D'
    );
  });

  it('with no services, says so and offers «Quitar filtros», back to this month (CA-08)', () => {
    renderScreen({
      state: filters({ plate: 'ZZZ99Z' }),
      rows: [],
      sums: totals({ services: 0, subtotal: 0, discounts: 0, total: 0 }),
    });

    expect(screen.getByText('No hay servicios con estos filtros.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Quitar filtros' })).toHaveAttribute(
      'href',
      '/reports/services?from=2026-11-01&to=2026-11-23'
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    // Nothing to take to Excel.
    expect(screen.queryByRole('link', { name: 'Exportar a Excel' })).not.toBeInTheDocument();
  });

  it('with no services this month and no other filter, does not offer to remove filters (CA-08)', () => {
    renderScreen({
      rows: [],
      sums: totals({ services: 0, subtotal: 0, discounts: 0, total: 0 }),
    });

    expect(screen.getByText('No hay servicios cerrados en este periodo.')).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Quitar filtros' })).not.toBeInTheDocument();
  });

  it('goes by pages of 50 with the same filters, counting every service of the filter (CA-11)', () => {
    // 120 services: pages of 50 → 3 pages; this is the second.
    renderScreen({
      state: filters({ plate: 'UIH03D', page: 2 }),
      sums: totals({ services: 120 }),
    });

    const pages = screen.getByRole('navigation', { name: 'Páginas del reporte' });
    expect(within(pages).getByText('Página 2 de 3')).toBeVisible();
    expect(within(pages).getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/reports/services?from=2026-11-01&to=2026-11-23&plate=UIH03D'
    );
    expect(within(pages).getByRole('link', { name: 'Siguiente' })).toHaveAttribute(
      'href',
      '/reports/services?from=2026-11-01&to=2026-11-23&plate=UIH03D&page=3'
    );
    expect(totalsOf()[0]).toEqual(['Servicios', '120']);
  });

  it('has no pages when everything fits in one (CA-11)', () => {
    renderScreen({ sums: totals({ services: 50 }) });

    expect(
      screen.queryByRole('navigation', { name: 'Páginas del reporte' })
    ).not.toBeInTheDocument();
  });
});
