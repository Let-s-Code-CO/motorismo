/**
 * HistoryScreen — the customer's «Historial» (spec 014, HU-02).
 *
 * Guards:
 * - CA-07: each closed order, newest first, with its date, vehicle, services and their value, the
 *   discount if any, the total and how it was paid.
 * - CA-10: with none, it says they have no services yet.
 * - CA-11: a page at a time: «Ver anteriores» leads to the older ones through the address
 *   (`?before=`, the date of the last one shown), and from there back to the newest.
 */
import { screen, within } from '@testing-library/react';

import HistoryScreen from '@web/modules/customer-area/components/organisms/history-screen.component';
import type { HistoryOrder } from '@web/modules/customer-area/types/customer-area.types';

import { renderWithProviders } from '@tests/test-utils/render';

const order = (overrides: Partial<HistoryOrder> = {}): HistoryOrder => ({
  id: 'o2',
  number: 2,
  closed_at: '2030-06-05T10:00:00-05:00',
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
  lines: [
    { name: 'Lavado detallado', price: 25000 },
    { name: 'Limpieza de cadena', price: 15000 },
  ],
  subtotal: 40000,
  discount: 5000,
  total: 35000,
  payments: [
    { method: 'cash', amount: 20000 },
    { method: 'card', amount: 15000 },
  ],
  ...overrides,
});

// HeroUI buttons rendered as links keep the button role; what matters is where they lead.
const link = (name: string) => screen.getByRole('button', { name });

describe('HistoryScreen', () => {
  it('shows each order with its services and values, discount, total and payments (CA-07)', () => {
    renderWithProviders(<HistoryScreen orders={[order()]} before={null} hasMore={false} />);

    const card = screen.getByRole('article', { name: /Orden #2/ });
    expect(within(card).getByText('5 de junio de 2030')).toBeVisible();
    expect(within(card).getByText('Suzuki GSX-R600 · UIH-03D')).toBeVisible();
    expect(within(card).getByText('Lavado detallado')).toBeVisible();
    expect(within(card).getByText('$ 25.000')).toBeVisible();
    expect(within(card).getByText('Limpieza de cadena')).toBeVisible();
    expect(within(card).getByText('$ 15.000')).toBeVisible();
    // 25 000 + 15 000 = 40 000, minus 5 000 = 35 000.
    expect(within(card).getByText('$ 40.000')).toBeVisible();
    expect(within(card).getByText('− $ 5.000')).toBeVisible();
    expect(within(card).getByText('$ 35.000')).toBeVisible();
    expect(within(card).getByText('Efectivo $ 20.000 · Tarjeta $ 15.000')).toBeVisible();
  });

  it('shows no discount line when there was none', () => {
    renderWithProviders(
      <HistoryScreen
        orders={[order({ discount: 0, subtotal: 40000, total: 40000 })]}
        before={null}
        hasMore={false}
      />
    );

    expect(screen.queryByText('Descuento')).not.toBeInTheDocument();
  });

  it('keeps the order it is given: newest first (CA-07)', () => {
    renderWithProviders(
      <HistoryScreen
        orders={[order(), order({ id: 'o1', number: 1, closed_at: '2030-06-01T10:00:00-05:00' })]}
        before={null}
        hasMore={false}
      />
    );

    expect(screen.getAllByRole('article').map((item) => item.getAttribute('aria-label'))).toEqual([
      'Orden #2',
      'Orden #1',
    ]);
  });

  it('says they have no services yet (CA-10)', () => {
    renderWithProviders(<HistoryScreen orders={[]} before={null} hasMore={false} />);

    expect(screen.getByText('Aún no tienes servicios.')).toBeVisible();
  });

  it('leads to the older ones from the last one shown, and back to the newest (CA-11)', () => {
    const { unmount } = renderWithProviders(
      <HistoryScreen
        orders={[order(), order({ id: 'o1', number: 1, closed_at: '2030-06-01T10:00:00-05:00' })]}
        before={null}
        hasMore
      />
    );
    // From the oldest one shown, the last of the page.
    expect(link('Ver anteriores')).toHaveAttribute(
      'href',
      `/my/history?before=${encodeURIComponent('2030-06-01T10:00:00-05:00')}`
    );
    unmount();

    renderWithProviders(
      <HistoryScreen orders={[order()]} before="2030-06-10T10:00:00-05:00" hasMore={false} />
    );
    expect(screen.queryByRole('button', { name: 'Ver anteriores' })).not.toBeInTheDocument();
    expect(link('Ver los más recientes')).toHaveAttribute('href', '/my/history');
  });
});
