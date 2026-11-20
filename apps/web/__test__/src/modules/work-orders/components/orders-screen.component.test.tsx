/**
 * OrdersScreen — «Órdenes»: what is being done, what waits its turn and what was handed over
 * (spec 008, HU-04, HU-07).
 *
 * Guards:
 * - CA-18: three sections, each with its colour: «En proceso» with the ready time (counted from
 *   the start, CA-34); «En cola» by arrival, with its turn and only its duration (when it will
 *   start is not known yet); «Cerradas».
 * - CA-33: an order in the queue is started from its row with «Empezar».
 * - CA-19: the closed ones, newest first, by pages («Página 1 de 3»); voided ones marked.
 */
import { fireEvent, screen, within } from '@testing-library/react';

import { startWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import OrdersScreen from '@web/modules/work-orders/components/organisms/orders-screen.component';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';

import { renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => '/orders',
}));
vi.mock('@web/modules/work-orders/actions/work-orders.actions', () => ({
  startWorkOrder: vi.fn(),
}));

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
    opened_at: '2026-11-20T19:00:00Z',
    started_at: null,
    closed_at: null,
    services: ['Lavado sencillo'],
    total: 25000,
    estimated_minutes: 30,
    unestimated: [],
    ...overrides,
  }) as WorkOrderSummary;

const sectionList = (name: string) =>
  within(screen.getByRole('list', { name })).getAllByRole('listitem');

describe('OrdersScreen', () => {
  afterEach(() => vi.clearAllMocks());

  it('splits the open orders into «En proceso», with the ready time from the start, and «En cola», by arrival with its turn (CA-18, CA-34)', () => {
    renderWithProviders(
      <OrdersScreen
        open={[
          order({ id: 'o4', number: 4, started_at: '2026-11-20T19:45:00Z' }),
          order({
            id: 'o5',
            number: 5,
            customer_name: 'Andrés Ñáñez',
            opened_at: '2026-11-20T19:10:00Z',
            estimated_minutes: 90,
          }),
          order({
            id: 'o6',
            number: 6,
            customer_name: 'Valentina Vásquez',
            opened_at: '2026-11-20T19:20:00Z',
            estimated_minutes: 0,
            unestimated: ['Otro'],
          }),
        ]}
        closed={{ rows: [], total: 0 }}
        page={1}
      />
    );

    const inProgress = sectionList('Órdenes en proceso');
    expect(inProgress).toHaveLength(1);
    // Started at 2:45 p. m. + 30 min.
    expect(inProgress[0]).toHaveTextContent('Orden #4 · Camila Cliente');
    expect(inProgress[0]).toHaveTextContent('Lista hacia las 3:15 p. m.');

    const queue = sectionList('Órdenes en cola');
    expect(queue).toHaveLength(2);
    expect(queue[0]).toHaveTextContent('1.º');
    expect(queue[0]).toHaveTextContent('Orden #5 · Andrés Ñáñez');
    expect(queue[0]).toHaveTextContent('≈ 1 h 30 min');
    expect(queue[0]).not.toHaveTextContent('Lista hacia');
    expect(queue[1]).toHaveTextContent('2.º');
    expect(queue[1]).toHaveTextContent('Sin tiempo estimado');
  });

  it('starts an order from its row in the queue, and announces it (CA-33)', async () => {
    vi.mocked(startWorkOrder).mockResolvedValue({ ok: true });
    renderWithProviders(
      <OrdersScreen
        open={[order({ id: 'o5', number: 5 })]}
        closed={{ rows: [], total: 0 }}
        page={1}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Empezar la orden #5' }));

    expect(await screen.findByText('Orden #5 en proceso.')).toBeVisible();
    expect(startWorkOrder).toHaveBeenCalledWith({ id: 'o5' });
    expect(refresh).toHaveBeenCalled();
  });

  it('says so when nothing is in progress or waiting', () => {
    renderWithProviders(<OrdersScreen open={[]} closed={{ rows: [], total: 0 }} page={1} />);

    expect(screen.getByText('Nada en proceso.')).toBeVisible();
    expect(screen.getByText('No hay vehículos esperando turno.')).toBeVisible();
  });

  it('lists the closed orders, newest first, marking the voided ones, by pages (CA-19)', () => {
    renderWithProviders(
      <OrdersScreen
        open={[]}
        closed={{
          rows: [
            order({ id: 'o3', number: 3, status: 'voided' }),
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

    const closed = sectionList('Órdenes cerradas');
    expect(closed[0]).toHaveTextContent('Anulada');
    expect(closed[1]).toHaveTextContent('$ 140.000');
    expect(closed[1]).toHaveTextContent('Entregada el 17 nov 2026');
    // 45 orders, 20 per page: page 1 of 3.
    expect(screen.getByText('Página 1 de 3')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Siguientes' })).toHaveAttribute(
      'href',
      '/orders?page=2'
    );
    expect(screen.queryByRole('link', { name: 'Anteriores' })).not.toBeInTheDocument();
  });
});
