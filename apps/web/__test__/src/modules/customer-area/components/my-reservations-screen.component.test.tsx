/**
 * MyReservationsScreen — the customer's «Mis reservas» (spec 014, HU-04).
 *
 * Guards:
 * - CA-17: the pending ones first with day, hour, vehicle, services and until when to arrive; then
 *   the recent past ones with their state, and who cancelled them.
 * - CA-20: only a pending reservation offers «Cambiar» and «Cancelar reserva».
 * - CA-19: cancelling asks first, takes an optional reason, and says «Reserva cancelada.»; a refusal
 *   stays in the dialog (spec 013, CA-08).
 * - With none, it says so; «Reservar» is always at hand.
 * - Spec 021, CA-05: several pending reservations of one vehicle (on different days), each with its
 *   own «Cambiar» and «Cancelar reserva».
 */
import { fireEvent, screen, within } from '@testing-library/react';

import { cancelMyReservation } from '@web/modules/customer-area/actions/customer-area.actions';
import MyReservationsScreen from '@web/modules/customer-area/components/organisms/my-reservations-screen.component';
import type { MyReservation } from '@web/modules/customer-area/types/customer-area.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@web/modules/customer-area/actions/customer-area.actions', () => ({
  cancelMyReservation: vi.fn(),
}));

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
  service_ids: ['s1'],
  services: ['Lavado detallado'],
  notes: null,
  grace_until: '2030-06-13T10:15:00-05:00',
  booked_by_customer: true,
  cancelled_by_customer: false,
  cancel_reason: null,
  ...overrides,
});

const pendingList = () => screen.getByRole('list', { name: 'Próximas' });
const pastList = () => screen.getByRole('list', { name: 'Anteriores' });
// HeroUI buttons rendered as links keep the button role; what matters is where they lead.

describe('MyReservationsScreen', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists the pending ones with day, hour, vehicle, services and until when to arrive (CA-17)', () => {
    renderWithProviders(
      <MyReservationsScreen
        reservations={[
          reservation(),
          reservation({
            id: 'r2',
            slot_start: '2030-06-14T09:00:00-05:00',
            slot_end: '2030-06-14T10:00:00-05:00',
            grace_until: '2030-06-14T09:15:00-05:00',
            vehicle_id: null,
            brand_name: null,
            line_name: null,
            plate: null,
            services: [],
          }),
        ]}
      />
    );

    const [first, second] = within(pendingList()).getAllByRole('listitem');
    expect(first).toHaveTextContent('jueves, 13 de junio, 10:00 a. m. – 11:00 a. m.');
    expect(first).toHaveTextContent('Suzuki GSX-R600 · UIH-03D');
    expect(first).toHaveTextContent('Lavado detallado');
    expect(first).toHaveTextContent('Puedes llegar hasta las 10:15 a. m. para conservar tu turno');
    expect(second).toHaveTextContent('viernes, 14 de junio');
    expect(second).toHaveTextContent('Sin vehículo');
  });

  it('offers to change or cancel only a pending one (CA-20)', () => {
    renderWithProviders(
      <MyReservationsScreen
        reservations={[
          reservation(),
          reservation({
            id: 'r9',
            status: 'attended',
            slot_start: '2030-06-01T10:00:00-05:00',
            slot_end: '2030-06-01T11:00:00-05:00',
          }),
        ]}
      />
    );

    expect(
      within(pendingList()).getByRole('button', { name: /^Cambiar la reserva del/ })
    ).toHaveAttribute('href', '/my/reservations/r1');
    expect(
      within(pendingList()).getByRole('button', { name: /^Cancelar reserva del/ })
    ).toBeVisible();
    expect(within(pastList()).queryByRole('button')).not.toBeInTheDocument();
    expect(within(pastList()).getByText('Atendida')).toBeVisible();
  });

  it('lists two pending reservations of the same vehicle, each changed or cancelled on its own (spec 021, CA-05)', () => {
    renderWithProviders(
      <MyReservationsScreen
        reservations={[
          reservation(),
          reservation({
            id: 'r2',
            slot_start: '2030-06-15T09:00:00-05:00',
            slot_end: '2030-06-15T10:00:00-05:00',
            grace_until: '2030-06-15T09:15:00-05:00',
          }),
        ]}
      />
    );

    const [thursday, saturday] = within(pendingList()).getAllByRole('listitem') as [
      HTMLElement,
      HTMLElement,
    ];
    expect(thursday).toHaveTextContent('jueves, 13 de junio');
    expect(saturday).toHaveTextContent('sábado, 15 de junio');
    for (const [item, id] of [
      [thursday, 'r1'],
      [saturday, 'r2'],
    ] as const) {
      expect(item).toHaveTextContent('Suzuki GSX-R600 · UIH-03D');
      expect(within(item).getByRole('button', { name: /^Cambiar la reserva del/ })).toHaveAttribute(
        'href',
        `/my/reservations/${id}`
      );
      expect(within(item).getByRole('button', { name: /^Cancelar reserva del/ })).toBeVisible();
    }
  });

  it('says who cancelled a past one (CA-17)', () => {
    renderWithProviders(
      <MyReservationsScreen
        reservations={[
          reservation({ id: 'r3', status: 'cancelled', cancelled_by_customer: true }),
          reservation({ id: 'r4', status: 'cancelled', cancelled_by_customer: false }),
        ]}
      />
    );

    const [byThem, byStaff] = within(pastList()).getAllByRole('listitem');
    expect(byThem).toHaveTextContent('La cancelaste tú');
    expect(byStaff).toHaveTextContent('La canceló el lavadero');
  });

  it('cancels after asking, with an optional reason, and says so (CA-19)', async () => {
    vi.mocked(cancelMyReservation).mockResolvedValue({ ok: true });
    renderWithProviders(<MyReservationsScreen reservations={[reservation()]} />);

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar reserva del/ }));
    const dialog = await screen.findByRole('dialog', { name: '¿Cancelar tu reserva?' });
    expect(cancelMyReservation).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText('Motivo (opcional)'), {
      target: { value: 'Me salió un viaje' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }));

    await vi.waitFor(() =>
      expect(cancelMyReservation).toHaveBeenCalledWith({ id: 'r1', reason: 'Me salió un viaje' })
    );
    expect(await inToasts().findByText('Reserva cancelada.')).toBeVisible();
    expect(refresh).toHaveBeenCalled();
  });

  it('keeps a refusal inside the dialog (spec 013, CA-08)', async () => {
    vi.mocked(cancelMyReservation).mockResolvedValue({ ok: false, error: 'notPending' });
    renderWithProviders(<MyReservationsScreen reservations={[reservation()]} />);

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar reserva del/ }));
    const dialog = await screen.findByRole('dialog', { name: '¿Cancelar tu reserva?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar reserva' }));

    expect(
      await within(dialog).findByText('Esta reserva ya no está pendiente.')
    ).toBeInTheDocument();
  });

  it('says there are none, and offers to book', () => {
    renderWithProviders(<MyReservationsScreen reservations={[]} />);

    expect(screen.getByText('No tienes reservas.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reservar' })).toHaveAttribute(
      'href',
      '/my/reservations/new'
    );
  });
});
