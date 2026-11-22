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
 * - Spec 012, CA-14 / CA-15 / CA-18: «En cola» goes by turn; an order from a reservation says
 *   «Reserva 9:00 a. m.», and a reservation whose customer is on its way sits in its place, without
 *   a turn, linking to the reservation.
 * - Spec 012, CA-33 / CA-34: it says until when it keeps its turn and how many minutes are left (the
 *   last 5 stand out), and «+5 min» gives it more time, up to 60.
 * - Spec 012, CA-38: it says how much time it was already given.
 */
import { fireEvent, screen, within } from '@testing-library/react';

import { extendReservationTolerance } from '@web/modules/reservations/actions/reservations.actions';
import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';
import { startWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import OrdersScreen from '@web/modules/work-orders/components/organisms/orders-screen.component';
import type { WorkOrderSummary } from '@web/modules/work-orders/types/work-orders.types';

import { renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  usePathname: () => '/orders',
}));
vi.mock('@web/modules/reservations/actions/reservations.actions', () => ({
  extendReservationTolerance: vi.fn(),
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
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('splits the open orders into «En proceso», with the ready time from the start, and «En cola», by arrival with its turn; each with vehicle, plate, services and total (CA-18, CA-34)', () => {
    // A fixed «now» (3:00 p. m. in Bogotá), so «Llegó hace …» is deterministic.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T20:00:00Z'));
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

    // Every order shows its vehicle with the plate, its services and its total; one in the queue,
    // how long ago it arrived (3:00 p. m. − 2:10 p. m. = 50 minutes).
    for (const row of [inProgress[0], queue[0]]) {
      expect(row).toHaveTextContent('Suzuki GSX-R600 · UIH-03D');
      expect(row).toHaveTextContent('Lavado sencillo');
      expect(row).toHaveTextContent('$ 25.000');
    }
    expect(queue[0]).toHaveTextContent('Llegó hace 50 minutos');
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

describe('OrdersScreen with reservations (spec 012)', () => {
  afterEach(() => vi.useRealTimers());

  it('orders the queue by turn, marks the reserved one and shows the one on its way without a turn (CA-14, CA-15, CA-18)', () => {
    // «Now» is 9:05 a. m. in Bogotá.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-06-12T14:05:00Z'));
    renderWithProviders(
      <OrdersScreen
        open={[
          order({
            id: 'walk-in',
            number: 3,
            customer_name: 'Lucía Llegada',
            opened_at: '2030-06-12T14:00:30Z',
            turn_at: '2030-06-12T14:00:30Z',
          }),
          order({
            id: 'reserved',
            number: 2,
            customer_name: 'Camilo Cliente',
            opened_at: '2030-06-12T14:05:00Z',
            turn_at: '2030-06-12T14:00:00Z',
            reservation_id: 'r9',
            reserved_start: '2030-06-12T14:00:00Z',
          }),
        ]}
        arriving={[
          {
            id: 'r-carla',
            customer_name: 'Carla Cliente',
            slot_start: '2030-06-12T14:00:00Z',
            grace_until: '2030-06-12T14:15:00Z',
          } as ReservationSummary,
        ]}
        closed={{ rows: [], total: 0 }}
        page={1}
      />
    );

    const queue = sectionList('Órdenes en cola');
    expect(queue.map((item) => item.textContent)).toEqual([
      expect.stringMatching(/^1\.ºOrden #2 · Camilo Cliente/),
      expect.stringMatching(/^Reserva por llegar/),
      expect.stringMatching(/^2\.ºOrden #3 · Lucía Llegada/),
    ]);
    expect(queue[0]).toHaveTextContent('Reserva 9:00 a. m.');
    expect(queue[2]).not.toHaveTextContent('Reserva 9:00 a. m.');
    expect(
      // Its name is what it shows (WCAG 2.5.3): «Reserva por llegar», the time and who.
      screen.getByRole('link', { name: /^Reserva por llegar.*Carla Cliente/ })
      // «Volver» from the reservation comes back to «Órdenes».
    ).toHaveAttribute('href', '/agenda/r-carla?from=orders');
    expect(queue[1]).toHaveTextContent('Carla Cliente reservó a las 9:00 a. m.; aún no llega.');
  });

  it('says when a reservation came late or early and goes by its arrival (RN-04, CA-16, CA-17)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2030-06-12T22:20:00Z'));
    renderWithProviders(
      <OrdersScreen
        open={[
          // Reserved 5:00 p. m., arrived on time: keeps 5:00 p. m.
          order({
            id: 'on-time',
            number: 6,
            customer_name: 'Gabriel',
            opened_at: '2030-06-12T22:01:00Z',
            turn_at: '2030-06-12T22:00:00Z',
            reservation_id: 'r6',
            reserved_start: '2030-06-12T22:00:00Z',
          }),
          // Reserved 6:00 p. m., arrived at 5:12 p. m.: early, by arrival.
          order({
            id: 'early',
            number: 9,
            customer_name: 'Sofía',
            opened_at: '2030-06-12T22:12:00Z',
            turn_at: '2030-06-12T22:12:00Z',
            reservation_id: 'r9',
            reserved_start: '2030-06-12T23:00:00Z',
          }),
          // Reserved 4:00 p. m., arrived at 5:14 p. m.: late, by arrival.
          order({
            id: 'late',
            number: 8,
            customer_name: 'Lina',
            opened_at: '2030-06-12T22:14:00Z',
            turn_at: '2030-06-12T22:14:00Z',
            reservation_id: 'r8',
            reserved_start: '2030-06-12T21:00:00Z',
          }),
        ]}
        closed={{ rows: [], total: 0 }}
        page={1}
      />
    );

    const queue = sectionList('Órdenes en cola');
    expect(queue[0]).toHaveTextContent('Reserva 5:00 p. m.');
    expect(queue[0]).not.toHaveTextContent('llegó');
    expect(queue[1]).toHaveTextContent('Reserva 6:00 p. m. · llegó antes');
    expect(queue[2]).toHaveTextContent('Reserva 4:00 p. m. · llegó tarde');
  });

  describe('a reservation on its way (spec 012, CA-33, CA-34)', () => {
    const arriving = (overrides: Partial<ReservationSummary> = {}) =>
      ({
        id: 'r-carla',
        customer_name: 'Carla Cliente',
        slot_start: '2030-06-12T14:00:00Z',
        grace_until: '2030-06-12T14:15:00Z',
        effective_tolerance_minutes: 15,
        ...overrides,
      }) as ReservationSummary;
    const renderAt = (instant: string, reservation: ReservationSummary) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(instant));
      renderWithProviders(
        <OrdersScreen open={[]} arriving={[reservation]} closed={{ rows: [], total: 0 }} page={1} />
      );
    };

    it('says until when it keeps its turn and how many minutes are left (CA-33)', () => {
      // 9:05 a. m.: its 15 minutes end at 9:15 a. m. → 10 left.
      renderAt('2030-06-12T14:05:00Z', arriving());

      const left = screen.getByText('Conserva su turno hasta las 9:15 a. m. · quedan 10 min');
      expect(left).toBeVisible();
      expect(left).not.toHaveClass('font-semibold');
    });

    it('makes the last 5 minutes stand out (CA-33)', () => {
      // 9:11:30 a. m.: 3.5 minutes left, shown as 4.
      renderAt('2030-06-12T14:11:30Z', arriving());

      expect(screen.getByText('Conserva su turno hasta las 9:15 a. m. · quedan 4 min')).toHaveClass(
        'font-semibold'
      );
    });

    it('gives 5 more minutes and says until when (CA-34)', async () => {
      vi.mocked(extendReservationTolerance).mockResolvedValue({ ok: true, minutes: 20 });
      renderAt('2030-06-12T14:05:00Z', arriving());

      fireEvent.click(
        screen.getByRole('button', { name: 'Dar 5 minutos más a Carla Cliente: +5 min' })
      );

      await vi.waitFor(() =>
        expect(extendReservationTolerance).toHaveBeenCalledWith({ id: 'r-carla' })
      );
      // 9:00 a. m. + 20 minutes.
      expect(
        await screen.findByText('Carla Cliente conserva su turno hasta las 9:20 a. m.')
      ).toBeVisible();
      expect(refresh).toHaveBeenCalled();
    });

    it('says how much time it was already given (CA-38)', () => {
      renderAt('2030-06-12T14:05:00Z', arriving({ extensions: 3, extended_minutes: 15 }));

      expect(screen.getByText('Ya se le dio +15 min (3 veces)')).toBeVisible();
    });

    it('says nothing of it when it was given no extra time (CA-38)', () => {
      renderAt('2030-06-12T14:05:00Z', arriving({ extensions: 0, extended_minutes: 0 }));

      expect(screen.queryByText(/Ya se le dio/)).not.toBeInTheDocument();
    });

    it('offers no more time once it has 60 minutes (RN-11)', () => {
      renderAt(
        '2030-06-12T14:05:00Z',
        arriving({ effective_tolerance_minutes: 60, grace_until: '2030-06-12T15:00:00Z' })
      );

      expect(screen.queryByRole('button', { name: /\+5 min/ })).not.toBeInTheDocument();
    });
  });
});
