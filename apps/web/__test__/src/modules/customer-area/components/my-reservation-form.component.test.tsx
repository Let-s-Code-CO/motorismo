/**
 * MyReservationForm — the customer books or changes a reservation of their own (spec 014, HU-03,
 * CA-18).
 *
 * Guards:
 * - CA-12: one of their vehicles or «Sin vehículo» (the only vehicle comes chosen), the day and its
 *   hours with free seats, the services offered for that vehicle, and a note; saving sends what was
 *   chosen and «Reserva guardada.» shows in «Mis reservas».
 * - CA-13: a closed day or a week not enabled offers no hours.
 * - CA-14: an hour that filled up meanwhile is said and the hours come back up to date.
 * - CA-15: the app's limit (one pending reservation per vehicle) is said.
 * - CA-18: changing starts with what the reservation has and sends its id.
 * The customer is never chosen here: the server takes it from the session.
 */
import { act, fireEvent, screen } from '@testing-library/react';

import { arrive } from '@web/modules/core/lib/toast.lib';
import { saveMyReservation } from '@web/modules/customer-area/actions/customer-area.actions';
import MyReservationForm from '@web/modules/customer-area/components/organisms/my-reservation-form.component';
import type {
  BookableDay,
  BookableService,
  MyReservation,
} from '@web/modules/customer-area/types/customer-area.types';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/my/reservations/new',
  useSearchParams: () => new URLSearchParams('date=2030-06-13'),
}));
vi.mock('@web/modules/customer-area/actions/customer-area.actions', () => ({
  saveMyReservation: vi.fn(),
}));

// The schema checks ids are UUIDs, as the database's are.
const SUZUKI = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const MAZDA = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const WASH = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';
const CHAIN = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const NINE = '2030-06-13T09:00:00-05:00';
const TEN = '2030-06-13T10:00:00-05:00';

const suzuki = {
  id: SUZUKI,
  vehicle_type: 'motorcycle',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  plate: 'UIH03D',
};
const mazda = {
  id: MAZDA,
  vehicle_type: 'car',
  brand_name: 'Mazda',
  line_name: 'CX-30',
  plate: 'KDM482',
};

const services: BookableService[] = [
  { id: WASH, name: 'Lavado detallado', motorcycle: true, car: true, bicycle: false },
  { id: CHAIN, name: 'Limpieza de cadena', motorcycle: true, car: false, bicycle: false },
];

const day = (overrides: Partial<BookableDay> = {}): BookableDay => ({
  date: '2030-06-13',
  state: 'open',
  slots: [
    { slot_start: NINE, slot_end: TEN, seats: 2, taken: 0, started: false },
    { slot_start: TEN, slot_end: '2030-06-13T11:00:00-05:00', seats: 2, taken: 1, started: false },
  ],
  ...overrides,
});

const renderForm = (props: Partial<Parameters<typeof MyReservationForm>[0]> = {}) =>
  renderWithProviders(
    <MyReservationForm day={day()} vehicles={[suzuki, mazda]} services={services} {...props} />
  );

const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /Reservar|Guardar cambios/ }));

describe('MyReservationForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('books their vehicle at an hour, with services and a note, and says so in «Mis reservas» (CA-12)', async () => {
    vi.mocked(saveMyReservation).mockResolvedValue({ ok: true, id: 'r-new' });
    renderForm();

    fireEvent.click(screen.getByRole('radio', { name: 'Suzuki GSX-R600 · UIH-03D' }));
    fireEvent.click(screen.getByRole('radio', { name: /^9:00 a\. m\./ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lavado detallado' }));
    fireEvent.change(screen.getByLabelText('Observaciones (opcional)'), {
      target: { value: 'Llego en la moto' },
    });
    submit();

    await vi.waitFor(() =>
      expect(saveMyReservation).toHaveBeenCalledWith({
        vehicle_id: SUZUKI,
        slot_start: NINE,
        service_ids: [WASH],
        notes: 'Llego en la moto',
      })
    );
    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/my/reservations'));
    act(() => arrive('/my/reservations'));
    expect(inToasts().getByText('Reserva guardada.')).toBeVisible();
  });

  it('offers «Sin vehículo», and only the services offered for the chosen vehicle (CA-12)', () => {
    renderForm();

    expect(screen.getByRole('radio', { name: 'Sin vehículo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Mazda CX-30 · KDM-482' }));

    expect(screen.getByRole('checkbox', { name: 'Lavado detallado' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Limpieza de cadena' })).not.toBeInTheDocument();
  });

  it('chooses their only vehicle by itself (spec 008, RN-10)', () => {
    renderForm({ vehicles: [suzuki] });

    expect(screen.getByRole('radio', { name: 'Suzuki GSX-R600 · UIH-03D' })).toBeChecked();
  });

  it('offers no hours on a closed day (CA-13)', () => {
    renderForm({ day: day({ state: 'closed', slots: [] }) });

    expect(screen.getByRole('status')).toHaveTextContent('Cerrado');
    expect(screen.queryByRole('radio', { name: /a\. m\./ })).not.toBeInTheDocument();
  });

  it.each([
    ['slotFull', 'Esa hora se llenó mientras elegías: elige otra.', true],
    [
      'customerLimit',
      'Ya tienes una reserva pendiente para ese vehículo (o sin vehículo): cámbiala si quieres otra hora.',
      false,
    ],
  ] as const)(
    'says a refusal (%s) inside the form (CA-14, CA-15)',
    async (error, text, refreshes) => {
      vi.mocked(saveMyReservation).mockResolvedValue({ ok: false, error });
      renderForm();

      fireEvent.click(screen.getByRole('radio', { name: 'Suzuki GSX-R600 · UIH-03D' }));
      fireEvent.click(screen.getByRole('radio', { name: /^9:00 a\. m\./ }));
      submit();

      expect(await screen.findByText(text)).toBeVisible();
      expect(inToasts().queryByText(text)).not.toBeInTheDocument();
      expect(router.refresh).toHaveBeenCalledTimes(refreshes ? 1 : 0);
    }
  );

  it('changes a reservation: it starts with what it has and sends its id (CA-18)', async () => {
    vi.mocked(saveMyReservation).mockResolvedValue({ ok: true, id: 'r1' });
    const reservation = {
      id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
      status: 'pending',
      slot_start: TEN,
      slot_end: '2030-06-13T11:00:00-05:00',
      vehicle_id: SUZUKI,
      service_ids: [CHAIN],
      notes: 'Antes de las 11',
    } as MyReservation;
    renderForm({ reservation });

    expect(screen.getByRole('radio', { name: 'Suzuki GSX-R600 · UIH-03D' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Limpieza de cadena' })).toBeChecked();
    expect(screen.getByLabelText('Observaciones (opcional)')).toHaveValue('Antes de las 11');
    submit();

    await vi.waitFor(() =>
      expect(saveMyReservation).toHaveBeenCalledWith({
        id: reservation.id,
        vehicle_id: SUZUKI,
        slot_start: TEN,
        service_ids: [CHAIN],
        notes: 'Antes de las 11',
      })
    );
  });
});
