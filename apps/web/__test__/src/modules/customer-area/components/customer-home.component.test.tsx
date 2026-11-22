/**
 * CustomerHome — the customer's «Inicio» (spec 014, RF-01).
 *
 * Guards:
 * - CA-03: each of their vehicles in the shop, apart.
 * - CA-04: with none in the shop, it says so and leads to booking and to their history.
 * - RF-01: their next reservation with until when they may arrive, or that they have none; ways to
 *   book, to their reservations and to their history.
 */
import { screen, within } from '@testing-library/react';

import CustomerHome from '@web/modules/customer-area/components/organisms/customer-home.component';
import type {
  MyReservation,
  ShopOrder,
} from '@web/modules/customer-area/types/customer-area.types';

import { renderWithProviders } from '@tests/test-utils/render';

const order = (overrides: Partial<ShopOrder> = {}): ShopOrder => ({
  id: 'o1',
  number: 4,
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
  opened_at: '2030-06-12T08:30:00-05:00',
  started_at: null,
  lines: [{ name: 'Lavado detallado', estimated_minutes: 45 }],
  ahead: 1,
  ...overrides,
});

const reservation = (overrides: Partial<MyReservation> = {}): MyReservation => ({
  id: 'r1',
  number: 7,
  status: 'pending',
  slot_start: '2030-06-13T10:00:00-05:00',
  slot_end: '2030-06-13T11:00:00-05:00',
  vehicle_id: 'v1',
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
  service_ids: [],
  services: ['Lavado detallado'],
  notes: null,
  grace_until: '2030-06-13T10:15:00-05:00',
  booked_by_customer: true,
  cancelled_by_customer: false,
  cancel_reason: null,
  ...overrides,
});

// HeroUI buttons rendered as links keep the button role; what matters is where they lead.
const action = (name: string) => screen.getByRole('button', { name });

describe('CustomerHome', () => {
  it('greets the customer and shows each of their vehicles in the shop apart (CA-03)', () => {
    renderWithProviders(
      <CustomerHome
        name="Camila Cliente"
        orders={[
          order(),
          order({
            id: 'o2',
            brand_name: 'Mazda',
            line_name: 'CX-30',
            plate: 'KDM482',
            vehicle_type: 'car',
          }),
        ]}
        next={null}
      />
    );

    expect(screen.getByRole('heading', { name: 'Hola, Camila', level: 1 })).toBeVisible();
    const shop = screen.getByRole('region', { name: 'En el lavadero' });
    expect(within(shop).getAllByRole('article')).toHaveLength(2);
    expect(within(shop).getByText('Mazda CX-30 · KDM-482')).toBeVisible();
  });

  it('says there is nothing in the shop and leads to booking and to the history (CA-04)', () => {
    renderWithProviders(<CustomerHome name="Camila Cliente" orders={[]} next={null} />);

    expect(screen.getByText('No tienes vehículos en el lavadero ahora.')).toBeVisible();
    expect(action('Reservar')).toHaveAttribute('href', '/my/reservations/new');
    expect(action('Ver historial')).toHaveAttribute('href', '/my/history');
    expect(screen.getByText('No tienes reservas pendientes.')).toBeVisible();
  });

  it('shows their next reservation and until when they may arrive (RF-01)', () => {
    renderWithProviders(<CustomerHome name="Camila Cliente" orders={[]} next={reservation()} />);

    const next = screen.getByRole('region', { name: 'Tu próxima reserva' });
    expect(within(next).getByText('jueves, 13 de junio, 10:00 a. m. – 11:00 a. m.')).toBeVisible();
    expect(
      within(next).getByText('Puedes llegar hasta las 10:15 a. m. para conservar tu turno')
    ).toBeVisible();
    expect(within(next).getByRole('button', { name: 'Mis reservas' })).toHaveAttribute(
      'href',
      '/my/reservations'
    );
  });
});
