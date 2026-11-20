/**
 * CustomerHistory — how many times a customer has come and what was done (spec 008, HU-03).
 *
 * Guards:
 * - CA-15 / RN-07: a visit is a closed order that was not voided; staff see how many, and the last
 *   two (date, vehicle, services and total).
 * - CA-16: on the customer record, every order, newest first, with its status: 10 at a time, «Ver
 *   más» adds 10 more (a loyal customer does not stretch the record without end).
 * - CA-17: a customer without visits is told apart: it is their first one.
 */
import { fireEvent, screen } from '@testing-library/react';

import CustomerHistory from '@web/modules/work-orders/components/organisms/customer-history.component';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';

import { renderWithProviders } from '@tests/test-utils/render';

const order = (overrides: Partial<WorkOrderSummary>): WorkOrderSummary =>
  ({
    id: 'o',
    number: 1,
    status: 'closed',
    customer_id: 'c1',
    customer_name: 'Camila Cliente',
    vehicle_id: 'v1',
    vehicle_type: 'motorcycle',
    plate: 'UIH03D',
    brand_name: 'Suzuki',
    line_name: 'GSX-R600',
    opened_at: '2026-11-17T15:00:00Z',
    closed_at: '2026-11-17T17:00:00Z',
    services: ['Lavado sencillo'],
    total: 25000,
    ...overrides,
  }) as WorkOrderSummary;

// Newest first, as the server lists them.
const ORDERS = [
  order({
    id: 'o4',
    number: 4,
    status: 'open',
    services: ['Lavado detallado'],
    closed_at: null,
    opened_at: '2026-11-20T15:00:00Z',
  }),
  order({ id: 'o3', number: 3, status: 'voided', opened_at: '2026-11-18T15:00:00Z' }),
  order({
    id: 'o2',
    number: 2,
    services: ['Lavado sencillo', 'Micropulido'],
    total: 140000,
    opened_at: '2026-11-17T15:00:00Z',
    closed_at: '2026-11-17T18:00:00Z',
  }),
  order({
    id: 'o1',
    number: 1,
    total: 25000,
    opened_at: '2026-11-10T15:00:00Z',
    closed_at: '2026-11-10T16:00:00Z',
  }),
  order({
    id: 'o0',
    number: 0,
    total: 15000,
    opened_at: '2026-11-01T15:00:00Z',
    closed_at: '2026-11-01T16:00:00Z',
  }),
];

describe('CustomerHistory', () => {
  it('counts the visits without the voided or open orders, and shows the last two (CA-15, RN-07)', () => {
    renderWithProviders(<CustomerHistory orders={ORDERS} variant="summary" />);

    // Closed and not voided: #2, #1 and #0 → 3 visits.
    expect(screen.getByText('3 visitas')).toBeVisible();
    const last = screen.getAllByRole('listitem');
    expect(last).toHaveLength(2);
    expect(last[0]).toHaveTextContent('Lavado sencillo · Micropulido');
    expect(last[0]).toHaveTextContent('$ 140.000');
    expect(last[0]).toHaveTextContent('17 nov 2026');
    expect(last[1]).toHaveTextContent('$ 25.000');
  });

  it('lists every order on the customer record, newest first, with its status (CA-16)', () => {
    renderWithProviders(<CustomerHistory orders={ORDERS} variant="full" />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Orden #4');
    expect(rows[0]).toHaveTextContent('En cola');
    expect(rows[1]).toHaveTextContent('Anulada');
    expect(screen.getByRole('link', { name: /Orden #2/ })).toHaveAttribute('href', '/orders/o2');
  });

  it('says it is the first visit when there is none (CA-17)', () => {
    renderWithProviders(<CustomerHistory orders={[ORDERS[0]!]} variant="summary" />);

    expect(screen.getByText('Primera visita: aún no tiene órdenes cerradas.')).toBeVisible();
  });

  it('shows 10 orders on the record, and «Ver más» adds the next ones (CA-16)', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      order({
        id: `m${i}`,
        number: 100 - i,
        opened_at: `2026-10-${String(20 - i).padStart(2, '0')}T15:00:00Z`,
      })
    );
    renderWithProviders(<CustomerHistory orders={many} variant="full" />);

    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();
  });

  it('shows «En cola» or «En proceso» for an open order (HU-07)', () => {
    renderWithProviders(
      <CustomerHistory
        orders={[
          order({ id: 'q', number: 7, status: 'open', closed_at: null, started_at: null }),
          order({
            id: 'p',
            number: 8,
            status: 'open',
            closed_at: null,
            started_at: '2026-11-20T15:00:00Z',
          }),
        ]}
        variant="full"
      />
    );

    expect(screen.getByText('En cola')).toBeVisible();
    expect(screen.getByText('En proceso')).toBeVisible();
  });
});
