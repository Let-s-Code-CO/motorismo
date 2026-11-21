/**
 * AgendaScreen — «Agenda»: one day of reservations, by slot (spec 012, HU-02).
 *
 * Guards:
 * - CA-09: the slots in order, each with its free seats («Llena» when there are none) and its
 *   reservations: customer, phone, vehicle (plate or «Sin vehículo»), services and state.
 * - CA-10: the previous and the next day, and «Hoy», are links that carry the day in the URL.
 * - CA-03: a closed day and a week not enabled say so.
 * - CA-31: a reservation that no longer fits the hours is listed apart; flagged ones show
 *   «Fuera del horario» and «Sobrecupo».
 * - «Horario» is offered only to an admin (HU-05).
 */
import { screen, within } from '@testing-library/react';

import AgendaScreen from '@web/modules/reservations/components/organisms/agenda-screen.component';
import type {
  AgendaDay,
  AgendaSlot,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

  it('offers «Reservar» only in a slot with a free seat that has not started', () => {
    renderAgenda(day({ slots: [slot(9, { started: true }), slot(10, { taken: 2 }), slot(11)] }));

    const links = screen.getAllByRole('link', { name: /Reservar/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('11:00 a. m. – 12:00 p. m.: Reservar');
    expect(links[0]).toHaveAttribute(
      'href',
      `/agenda/new?date=2030-06-12&start=${encodeURIComponent(at(11))}`
    );
  });

  it('says when the day has no reservations', () => {
    renderAgenda(day());

    expect(screen.getByText('No hay reservas este día.')).toBeVisible();
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
});
