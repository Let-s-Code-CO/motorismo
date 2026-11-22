/**
 * ReservationDetail — a reservation and what can be done with it (spec 012).
 *
 * Guards:
 * - CA-11: who, phone, vehicle, services, slot, tolerance (general or its own), notes, state and who
 *   did what and when.
 * - CA-12 / CA-19: «Llegó» only on a pending reservation of today; it opens «Nueva orden» with it.
 * - CA-20 / CA-21: a pending one can be changed and cancelled.
 * - CA-22: «No asistió» only once its tolerance has passed.
 * - CA-23: an attended, cancelled or no-show reservation offers nothing; an attended one links to
 *   its order (RF-04).
 * - CA-24 / CA-25: the admin changes its tolerance; an operator only sees it.
 * - CA-31: «Fuera del horario» and «Sobrecupo».
 */
import { fireEvent, screen, within } from '@testing-library/react';

import { markNoShow } from '@web/modules/reservations/actions/reservations.actions';
import ReservationDetail from '@web/modules/reservations/components/organisms/reservation-detail.component';
import type { ReservationSummary } from '@web/modules/reservations/types/reservations.types';

import { renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/reservations/actions/reservations.actions', () => ({
  markNoShow: vi.fn(),
  cancelReservation: vi.fn(),
  setReservationTolerance: vi.fn(),
}));

const reservation = (overrides: Partial<ReservationSummary> = {}) =>
  ({
    id: 'r1',
    status: 'pending',
    day: '2030-06-12',
    customer_name: 'Camila Cliente',
    customer_phone: '3001234567',
    vehicle_id: 'v1',
    vehicle_type: 'motorcycle',
    brand_name: 'Suzuki',
    line_name: 'GSX-R600',
    plate: 'UIH03D',
    services: ['Lavado detallado'],
    slot_start: '2030-06-12T09:00:00-05:00',
    slot_end: '2030-06-12T10:00:00-05:00',
    tolerance_minutes: null,
    effective_tolerance_minutes: 15,
    grace_until: '2030-06-12T09:15:00-05:00',
    notes: 'Trae un rayón',
    created_at: '2030-06-10T15:30:00-05:00',
    created_by_name: 'Oscar Operador',
    out_of_hours: false,
    over_capacity: false,
    work_order_id: null,
    ...overrides,
  }) as ReservationSummary;

const renderDetail = (r: ReservationSummary, { isAdmin = false, today = '2030-06-12' } = {}) =>
  renderWithProviders(
    <ReservationDetail reservation={r} today={today} isAdmin={isAdmin} generalTolerance={15} />
  );

/** «Now» in Bogotá, so the tolerance has or has not passed. */
const nowAt = (instant: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(instant));
};

describe('ReservationDetail', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('shows the whole reservation and who made it (CA-11)', () => {
    nowAt('2030-06-12T08:00:00-05:00');
    renderDetail(reservation());

    expect(
      screen.getByRole('heading', { name: 'Reserva de Camila Cliente', level: 1 })
    ).toBeVisible();
    expect(screen.getByText('Pendiente')).toBeVisible();
    expect(
      screen.getByText('Miércoles, 12 de junio de 2030 · 9:00 a. m. – 10:00 a. m.', {
        exact: false,
      })
    ).toBeVisible();
    expect(screen.getByText('300 123 4567')).toBeVisible();
    expect(screen.getByText('Suzuki GSX-R600 · UIH-03D')).toBeVisible();
    expect(screen.getByText('Lavado detallado')).toBeVisible();
    expect(screen.getByText('15 min (la general)')).toBeVisible();
    expect(screen.getByText('Trae un rayón')).toBeVisible();
    expect(
      screen.getByText('Creada por Oscar Operador el 10 de junio de 2030 a las 3:30 p. m.')
    ).toBeVisible();
  });

  it('shows its own tolerance when it has one (CA-24)', () => {
    renderDetail(reservation({ tolerance_minutes: 30, effective_tolerance_minutes: 30 }));

    expect(screen.getByText('30 min (propia de esta reserva)')).toBeVisible();
  });

  it('offers «Llegó» on a pending reservation of today, opening «Nueva orden» with it (CA-12, CA-19)', () => {
    nowAt('2030-06-12T08:00:00-05:00');
    renderDetail(reservation());

    expect(screen.getByRole('button', { name: 'Llegó' })).toHaveAttribute(
      'href',
      '/orders/new?reservation=r1'
    );
    expect(screen.getByRole('button', { name: 'Cambiar' })).toHaveAttribute(
      'href',
      '/agenda/r1?edit=1&date=2030-06-12'
    );
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeVisible();
  });

  it('does not offer «Llegó» on another day (CA-19)', () => {
    renderDetail(reservation(), { today: '2030-06-11' });

    expect(screen.queryByRole('button', { name: 'Llegó' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeVisible();
  });

  it('offers «No asistió» only once the tolerance has passed, and marks it (CA-22)', async () => {
    vi.mocked(markNoShow).mockResolvedValue({ ok: true });
    nowAt('2030-06-12T09:15:00-05:00');
    const { unmount } = renderDetail(reservation());
    expect(screen.queryByRole('button', { name: 'No asistió' })).not.toBeInTheDocument();
    unmount();

    nowAt('2030-06-12T09:16:00-05:00');
    renderDetail(reservation());
    fireEvent.click(screen.getByRole('button', { name: 'No asistió' }));

    await vi.waitFor(() => expect(markNoShow).toHaveBeenCalledWith({ id: 'r1' }));
    expect(await screen.findByText('Reserva marcada como «No asistió».')).toBeVisible();
    expect(refresh).toHaveBeenCalled();
  });

  it.each([
    ['attended', 'Atendida'],
    ['cancelled', 'Cancelada'],
    ['no_show', 'No asistió'],
  ] as const)('offers nothing on a reservation %s (CA-23)', (status, label) => {
    nowAt('2030-06-12T11:00:00-05:00');
    // An attended reservation always has its order (RF-04).
    renderDetail(
      reservation({
        status,
        work_order_id: status === 'attended' ? 'o7' : null,
        work_order_number: 7,
      }),
      { isAdmin: true }
    );

    expect(screen.getByText(label, { selector: 'span *, span' })).toBeVisible();
    for (const action of ['Llegó', 'Cambiar', 'Cancelar reserva', 'Cambiar tolerancia']) {
      expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument();
    }
  });

  it('links an attended reservation to its order (RF-04)', () => {
    renderDetail(reservation({ status: 'attended', work_order_id: 'o7', work_order_number: 7 }));

    expect(screen.getByRole('button', { name: 'Orden #7' })).toHaveAttribute('href', '/orders/o7');
  });

  it('lets the admin change the tolerance, never an operator (CA-24, CA-25)', () => {
    const { unmount } = renderDetail(reservation(), { isAdmin: true });
    expect(screen.getByRole('button', { name: 'Cambiar tolerancia' })).toBeVisible();
    unmount();

    renderDetail(reservation(), { isAdmin: false });
    expect(screen.queryByRole('button', { name: 'Cambiar tolerancia' })).not.toBeInTheDocument();
    expect(screen.getByText('15 min (la general)')).toBeVisible();
  });

  it('shows «Fuera del horario» and «Sobrecupo» (CA-31)', () => {
    renderDetail(reservation({ out_of_hours: true, over_capacity: true }));

    expect(screen.getByText('Fuera del horario')).toBeVisible();
    expect(screen.getByText('Sobrecupo')).toBeVisible();
  });

  it('says who changed, cancelled or attended it, when, and why it was cancelled (CA-11)', () => {
    renderDetail(
      reservation({
        status: 'cancelled',
        updated_at: '2030-06-11T09:00:00-05:00',
        updated_by_name: 'Oscar Operador',
        cancelled_at: '2030-06-11T10:30:00-05:00',
        cancelled_by_name: 'Ana Admin',
        cancel_reason: 'Se le dañó la moto',
      })
    );

    expect(
      screen.getByText('Cambiada por Oscar Operador el 11 de junio de 2030 a las 9:00 a. m.')
    ).toBeVisible();
    expect(
      screen.getByText('Cancelada por Ana Admin el 11 de junio de 2030 a las 10:30 a. m.')
    ).toBeVisible();
    expect(screen.getByText('Motivo: Se le dañó la moto')).toBeVisible();
  });

  it('says who attended it and who marked it a no-show, and when (CA-11)', () => {
    const { unmount } = renderDetail(
      reservation({
        status: 'attended',
        attended_at: '2030-06-12T09:05:00-05:00',
        attended_by_name: 'Oscar Operador',
        work_order_id: 'o7',
        work_order_number: 7,
      })
    );
    expect(
      screen.getByText('Atendida por Oscar Operador el 12 de junio de 2030 a las 9:05 a. m.')
    ).toBeVisible();
    unmount();

    renderDetail(
      reservation({
        status: 'no_show',
        no_show_at: '2030-06-12T09:20:00-05:00',
        no_show_by_name: 'Ana Admin',
      })
    );
    expect(
      screen.getByText('Marcada «No asistió» por Ana Admin el 12 de junio de 2030 a las 9:20 a. m.')
    ).toBeVisible();
  });

  it('says «Pasó su tolerancia» once it has passed, next to «No asistió», and not before (CA-37)', () => {
    nowAt('2030-06-12T09:15:00-05:00');
    const { unmount } = renderDetail(reservation());
    expect(screen.queryByText('Pasó su tolerancia')).not.toBeInTheDocument();
    unmount();

    nowAt('2030-06-12T09:16:00-05:00');
    renderDetail(reservation());
    expect(screen.getByText('Pasó su tolerancia')).toBeVisible();
    expect(screen.getByRole('button', { name: 'No asistió' })).toBeVisible();
  });

  it('lists every «+5 min» it was given, by whom, when and until when, with the total (CA-38)', () => {
    renderWithProviders(
      <ReservationDetail
        reservation={reservation()}
        today="2030-06-12"
        isAdmin={false}
        generalTolerance={15}
        extensions={[
          {
            id: 'e1',
            reservation_id: 'r1',
            minutes: 5,
            tolerance_after: 20,
            grace_until: '2030-06-12T09:20:00-05:00',
            created_at: '2030-06-12T09:12:00-05:00',
            created_by_name: 'Oscar Operador',
          },
          {
            id: 'e2',
            reservation_id: 'r1',
            minutes: 5,
            tolerance_after: 25,
            grace_until: '2030-06-12T09:25:00-05:00',
            created_at: '2030-06-12T09:18:00-05:00',
            created_by_name: 'Ana Admin',
          },
        ]}
      />
    );

    const given = screen.getByRole('region', { name: 'Más tiempo para llegar' });
    expect(given).toHaveTextContent('Se le dio más tiempo 2 veces: 10 min en total');
    expect(
      within(given).getByText(
        '+5 min, dados por Oscar Operador el 12 de junio a las 9:12 a. m.: conservó su turno hasta las 9:20 a. m.'
      )
    ).toBeVisible();
    expect(within(given).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows no such section when it was given no extra time (CA-38)', () => {
    renderDetail(reservation());

    expect(
      screen.queryByRole('region', { name: 'Más tiempo para llegar' })
    ).not.toBeInTheDocument();
  });

  it('goes back to «Órdenes» when it was opened from the queue, else to its day', () => {
    const { unmount } = renderWithProviders(
      <ReservationDetail
        reservation={reservation()}
        today="2030-06-12"
        isAdmin={false}
        generalTolerance={15}
        backTo="orders"
      />
    );
    expect(screen.getByRole('link', { name: 'Volver a órdenes' })).toHaveAttribute(
      'href',
      '/orders'
    );
    unmount();

    renderDetail(reservation());
    expect(screen.getByRole('link', { name: 'Volver a la agenda' })).toHaveAttribute(
      'href',
      '/agenda?date=2030-06-12'
    );
  });
});
