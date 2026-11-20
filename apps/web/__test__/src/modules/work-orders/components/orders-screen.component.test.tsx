/**
 * OrdersScreen — «Órdenes»: what is in the car wash and what was handed over (spec 008, HU-04).
 *
 * Guards:
 * - CA-18: the open orders («En el lavadero»), oldest first, with number, customer, vehicle,
 *   services, total, how long ago they arrived and when they should be ready (HU-06).
 * - CA-19: the closed ones, newest first, by pages, with their date and total; voided ones marked.
 */
import { screen, within } from '@testing-library/react';

import OrdersScreen from '@web/modules/work-orders/components/organisms/orders-screen.component';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ usePathname: () => '/orders' }));

const order = (overrides: Partial<WorkOrderSummary>): WorkOrderSummary =>
  ({
    id: 'o',
    number: 1,
    status: 'open',
    customer_id: 'c1',
    customer_name: 'Camila Cliente',
    vehicle_type: 'motorcycle',
    plate: 'UIH03D',
    brand_name: 'Suzuki',
    line_name: 'GSX-R600',
    opened_at: '2026-11-20T19:45:00Z',
    closed_at: null,
    services: ['Lavado sencillo'],
    total: 25000,
    estimated_minutes: 30,
    unestimated: [],
    ...overrides,
  }) as WorkOrderSummary;

describe('OrdersScreen', () => {
  it('lists what is in the car wash, oldest first, with the ready time (CA-18)', () => {
    renderWithProviders(
      <OrdersScreen
        open={[
          order({ id: 'o4', number: 4 }),
          order({
            id: 'o5',
            number: 5,
            customer_name: 'Valentina Vásquez',
            estimated_minutes: 0,
            unestimated: ['Otro'],
          }),
        ]}
        closed={{ rows: [], total: 0 }}
        page={1}
      />
    );

    const open = within(screen.getByRole('list', { name: 'Órdenes en el lavadero' })).getAllByRole(
      'listitem'
    );
    expect(open[0]).toHaveTextContent('Orden #4 · Camila Cliente');
    expect(open[0]).toHaveTextContent('Suzuki GSX-R600 · UIH-03D');
    expect(open[0]).toHaveTextContent('$ 25.000');
    // Received at 2:45 p. m. + 30 min.
    expect(open[0]).toHaveTextContent('Lista hacia las 3:15 p. m.');
    expect(open[1]).toHaveTextContent('Sin tiempo estimado');
  });

  it('lists the closed orders, newest first, marking the voided ones, by pages (CA-19)', () => {
    renderWithProviders(
      <OrdersScreen
        open={[]}
        closed={{
          rows: [
            order({ id: 'o3', number: 3, status: 'voided', closed_at: null }),
            order({
              id: 'o2',
              number: 2,
              status: 'closed',
              closed_at: '2026-11-17T18:00:00Z',
              total: 140000,
            }),
          ],
          total: 45,
        }}
        page={1}
      />
    );

    expect(screen.getByText('No hay vehículos en el lavadero.')).toBeVisible();
    const closed = within(screen.getByRole('list', { name: 'Órdenes cerradas' })).getAllByRole(
      'listitem'
    );
    expect(closed[0]).toHaveTextContent('Anulada');
    expect(closed[1]).toHaveTextContent('$ 140.000');
    expect(closed[1]).toHaveTextContent('Entregada el 17 nov 2026');
    // 45 orders, 20 per page: page 1 of 3.
    expect(screen.getByRole('link', { name: 'Siguientes' })).toHaveAttribute(
      'href',
      '/orders?page=2'
    );
    expect(screen.queryByRole('link', { name: 'Anteriores' })).not.toBeInTheDocument();
  });
});
