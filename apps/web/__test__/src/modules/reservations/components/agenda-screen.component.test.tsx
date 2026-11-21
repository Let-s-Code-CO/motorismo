/**
 * AgendaScreen — «Agenda»: one day as a board of seats, by slot (spec 012, HU-02).
 *
 * Guards:
 * - CA-09: the slots in order, each with how many seats are free («Llena» when there are none) and
 *   one box per seat: a reservation (customer, phone, vehicle — plate or «Sin vehículo» —, services
 *   and state) or a free seat to book; as many boxes as seats (2, 5…). Cancelled ones and no-shows
 *   take no seat: they are listed apart. Above, how many reservations and free seats the day has.
 * - CA-10: the previous and the next day, and «Hoy», are links that carry the day in the URL; a
 *   date chosen in the calendar field goes there too (an invalid one is ignored).
 * - CA-03: a closed day and a week not enabled say so.
 * - CA-31: a reservation that no longer fits the hours is listed apart; flagged ones show
 *   «Fuera del horario» and «Sobrecupo».
 * - «Horario» is offered only to an admin (HU-05).
 */
import { fireEvent, screen, within } from '@testing-library/react';

import AgendaScreen from '@web/modules/reservations/components/organisms/agenda-screen.component';
import type {
  AgendaDay,
  AgendaSlot,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';

import { renderWithProviders } from '@tests/test-utils/render';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const at = (hour: number) => `2030-06-12T${String(hour).padStart(2, '0')}:00:00-05:00`;

const slot = (hour: number, overrides: Partial<AgendaSlot> = {}): AgendaSlot => ({
  slot_start: at(hour),
  slot_end: at(hour + 1),
  seats: 2,
  taken: 0,
  started: false,
  ...overrides,
});

const reservation = (overrides: Partial<ReservationSummary> = {}) =>
  ({
    id: 'r1',
    status: 'pending',
    customer_name: 'Camila Cliente',
    customer_phone: '3001234567',
    vehicle_id: 'v1',
    vehicle_type: 'motorcycle',
    brand_name: 'Suzuki',
    line_name: 'GSX-R600',
    plate: 'UIH03D',
    services: ['Lavado detallado'],
    slot_start: at(9),
    slot_end: at(10),
    out_of_hours: false,
    over_capacity: false,
    ...overrides,
  }) as ReservationSummary;

const day = (overrides: Partial<AgendaDay> = {}): AgendaDay => ({
  date: '2030-06-12',
  state: 'open',
  slots: [slot(9), slot(10)],
  reservations: [],
  ...overrides,
});

const renderAgenda = (agenda: AgendaDay, isAdmin = false) =>
  renderWithProviders(<AgendaScreen day={agenda} today="2030-06-12" isAdmin={isAdmin} />);

describe('AgendaScreen', () => {
  it('lists the slots in order, each with its free seats and its reservations (CA-09)', () => {
    renderAgenda(
      day({
        slots: [slot(9, { taken: 2 }), slot(10, { taken: 1 })],
        reservations: [
          reservation(),
          reservation({
            id: 'r2',
            customer_name: 'Valentina Vásquez',
            customer_phone: '3157654321',
            vehicle_id: null,
            services: [],
          }),
        ],
      })
    );

    const slots = within(screen.getByRole('list', { name: 'Franjas del día' })).getAllByRole(
      'listitem',
      {
        name: /a\. m\. – /,
      }
    );
    expect(slots.map((item) => item.getAttribute('aria-label'))).toEqual([
      '9:00 a. m. – 10:00 a. m.',
      '10:00 a. m. – 11:00 a. m.',
    ]);
    expect(within(slots[0]!).getByText('Llena')).toBeVisible();
    expect(within(slots[1]!).getByText('1 de 2 libres')).toBeVisible();

    const camila = within(slots[0]!).getByRole('link', { name: /Camila Cliente/ });
    expect(camila).toHaveAttribute('href', '/agenda/r1');
    expect(camila).toHaveTextContent('300 123 4567');
    expect(camila).toHaveTextContent('Suzuki GSX-R600 · UIH-03D');
    expect(camila).toHaveTextContent('Lavado detallado');
    expect(camila).toHaveTextContent('Pendiente');

    const valentina = within(slots[0]!).getByRole('link', { name: /Valentina Vásquez/ });
    expect(valentina).toHaveTextContent('Sin vehículo');
    expect(valentina).toHaveTextContent('Sin servicios');
  });

  it('offers «Reservar» in each free seat of a slot that has not started (CA-09)', () => {
    renderAgenda(day({ slots: [slot(9, { started: true }), slot(10, { taken: 2 }), slot(11)] }));

    // 11:00 has its 2 seats free: one «Reservar» per seat; 9:00 started and 10:00 is full.
    const links = screen.getAllByRole('link', { name: /Reservar/ });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAccessibleName('11:00 a. m. – 12:00 p. m.: Reservar');
      expect(link).toHaveAttribute(
        'href',
        `/agenda/new?date=2030-06-12&start=${encodeURIComponent(at(11))}`
      );
    }
  });

  it('draws one box per seat, also with more than two seats', () => {
    renderAgenda(day({ slots: [slot(9, { seats: 5, taken: 1 })], reservations: [reservation()] }));

    // 5 seats: 1 taken by Camila + 4 free.
    const seats = screen.getByRole('list', { name: 'Puestos de 9:00 a. m. – 10:00 a. m.' });
    expect(within(seats).getAllByRole('listitem')).toHaveLength(5);
    expect(within(seats).getAllByRole('link', { name: /Reservar/ })).toHaveLength(4);
    expect(screen.getByText('4 de 5 libres')).toBeVisible();
  });

  it('lists cancelled reservations and no-shows apart, taking no seat (RN-02)', () => {
    renderAgenda(
      day({
        slots: [slot(9)],
        reservations: [
          reservation({ id: 'r2', status: 'cancelled', customer_name: 'Andrés Ñáñez' }),
          reservation({ id: 'r3', status: 'no_show', customer_name: 'Lucía Llegada' }),
        ],
      })
    );

    const seats = screen.getByRole('list', { name: 'Puestos de 9:00 a. m. – 10:00 a. m.' });
    expect(within(seats).getAllByRole('link', { name: /Reservar/ })).toHaveLength(2);
    expect(screen.getByText('No ocupan puesto:')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Andrés Ñáñez · Cancelada' })).toHaveAttribute(
      'href',
      '/agenda/r2'
    );
    expect(screen.getByRole('link', { name: 'Lucía Llegada · No asistió' })).toBeVisible();
  });

  it('sums up the day: its reservations and the seats still free (CA-09)', () => {
    renderAgenda(
      day({
        slots: [slot(9, { started: true }), slot(10, { taken: 1 }), slot(11)],
        reservations: [reservation({ slot_start: at(10) })],
      })
    );

    // Free seats only count where they can still be booked: 10:00 (2 − 1 = 1) + 11:00 (2) = 3.
    expect(screen.getByText('1 reserva · 3 puestos libres')).toBeVisible();
  });

  it('says when the day has no reservations', () => {
    renderAgenda(day());

    // 9:00 and 10:00, 2 seats each: 4 free.
    expect(screen.getByText('Sin reservas · 4 puestos libres')).toBeVisible();
  });

  // HeroUI buttons rendered as links keep the button role; what matters is where they lead.
  it('moves to the previous and the next day, and back to today, through the URL (CA-10)', () => {
    renderAgenda(day({ date: '2030-06-30' }));

    expect(screen.getByRole('button', { name: 'Día anterior' })).toHaveAttribute(
      'href',
      '/agenda?date=2030-06-29'
    );
    expect(screen.getByRole('button', { name: 'Día siguiente' })).toHaveAttribute(
      'href',
      '/agenda?date=2030-07-01'
    );
    expect(screen.getByRole('button', { name: 'Hoy' })).toHaveAttribute(
      'href',
      '/agenda?date=2030-06-12'
    );
  });

  it('says «Cerrado» on a closed day and «Semana sin habilitar» on a week not enabled (CA-03)', () => {
    const { unmount } = renderAgenda(day({ state: 'closed', slots: [] }));
    expect(screen.getByText('Cerrado')).toBeVisible();
    unmount();

    renderAgenda(day({ state: 'unenabled', slots: [] }));
    expect(screen.getByText('Semana sin habilitar')).toBeVisible();
  });

  it('lists apart the reservations that no longer fit the hours, flagged (CA-31)', () => {
    renderAgenda(
      day({
        state: 'closed',
        slots: [],
        reservations: [
          reservation({ out_of_hours: true }),
          reservation({ id: 'r2', over_capacity: true }),
        ],
      })
    );

    const apart = screen.getByRole('list', { name: 'Fuera del horario' });
    expect(within(apart).getAllByRole('link')).toHaveLength(2);
    expect(within(apart).getAllByText('Fuera del horario')).toHaveLength(1);
    expect(within(apart).getByText('Sobrecupo')).toBeVisible();
  });

  it('offers «Horario» to an admin only (HU-05)', () => {
    const { unmount } = renderAgenda(day(), true);
    expect(screen.getByRole('button', { name: 'Horario' })).toHaveAttribute(
      'href',
      '/agenda/schedule?week=2030-06-10'
    );
    unmount();

    renderAgenda(day(), false);
    expect(screen.queryByRole('button', { name: 'Horario' })).not.toBeInTheDocument();
  });

  it('goes to a date chosen in the calendar field, through the URL (CA-10)', () => {
    renderAgenda(day());

    fireEvent.change(screen.getByLabelText('Ir a la fecha'), { target: { value: '2030-07-04' } });

    expect(push).toHaveBeenCalledWith('/agenda?date=2030-07-04');
  });
});
