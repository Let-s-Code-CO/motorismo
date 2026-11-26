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
 * - CA-15: the app's limit (one pending reservation per vehicle a day, spec 021) is said.
 * - CA-18: changing starts with what the reservation has and sends its id.
 * - Spec 021, CA-06: the estimated time of the chosen services, only those offered for the chosen
 *   vehicle (the ones it would send), updated as they are ticked.
 * The customer is never chosen here: the server takes it from the session.
 */
import { act, fireEvent, screen, within } from '@testing-library/react';

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
  {
    id: WASH,
    name: 'Lavado detallado',
    motorcycle: true,
    car: true,
    bicycle: false,
    estimated_minutes: 90,
    package: false,
    includes: [],
  },
  {
    id: CHAIN,
    name: 'Limpieza de cadena',
    motorcycle: true,
    car: false,
    bicycle: false,
    estimated_minutes: 15,
    package: false,
    includes: [],
  },
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

  it('shows the estimated time of the services ticked for the chosen vehicle (spec 021, CA-06)', () => {
    renderForm();
    const estimate = () => document.querySelector<HTMLElement>('[data-booking-estimate]')!;
    fireEvent.click(screen.getByRole('radio', { name: 'Suzuki GSX-R600 · UIH-03D' }));
    expect(estimate()).toBeEmptyDOMElement();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Lavado detallado' }));
    expect(estimate()).toHaveTextContent('Tiempo estimado: ≈ 1 h 30 min');
    // 90 + 15 min.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Limpieza de cadena' }));
    expect(estimate()).toHaveTextContent('Tiempo estimado: ≈ 1 h 45 min');

    // The chain is not offered for the car: it would not be sent, so it does not count (90 min).
    fireEvent.click(screen.getByRole('radio', { name: 'Mazda CX-30 · KDM-482' }));
    expect(estimate()).toHaveTextContent('Tiempo estimado: ≈ 1 h 30 min');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Lavado detallado' }));
    expect(estimate()).toBeEmptyDOMElement();
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
      // Spec 021, RN-01: one a day, so the message speaks of that day.
      'Ya tienes una reserva ese día para ese vehículo (o sin vehículo): cámbiala si quieres otra hora.',
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

  it('changes a reservation: it starts with what it has, its estimated time included, and sends its id (CA-18; spec 021, CA-06)', async () => {
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
    // Spec 021, CA-06: the time of what it already has, before touching anything (15 min).
    expect(document.querySelector('[data-booking-estimate]')).toHaveTextContent(
      'Tiempo estimado: ≈ 15 min'
    );
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

  describe('packages and what they include (spec 024, CA-23, CA-24)', () => {
    it('disables what a ticked package includes and any other package, saying why', () => {
      const PREMIUM = '4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f80';
      const DELUXE = '5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8091';
      const pkg = (id: string, name: string, includes: string[]): BookableService => ({
        id,
        name,
        motorcycle: true,
        car: false,
        bicycle: false,
        estimated_minutes: null,
        package: true,
        includes,
      });
      renderForm({
        services: [pkg(PREMIUM, 'Premium', [CHAIN]), pkg(DELUXE, 'Deluxe', []), ...services],
      });

      fireEvent.click(screen.getByRole('checkbox', { name: /^Premium/ }));

      expect(screen.getByRole('checkbox', { name: /^Limpieza de cadena/ })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: /^Limpieza de cadena/ })).toHaveAccessibleName(
        'Limpieza de cadena Incluido en Premium'
      );
      expect(screen.getByRole('checkbox', { name: /^Deluxe/ })).toHaveAccessibleName(
        'Deluxe Ya hay un paquete: Premium'
      );
    });

    it('groups the services: «Paquetes» apart from «Servicios adicionales» (CA-28)', () => {
      renderForm({
        services: [
          {
            id: '4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f80',
            name: 'Premium',
            motorcycle: true,
            car: false,
            bicycle: false,
            estimated_minutes: null,
            package: true,
            includes: [],
          },
          ...services,
        ],
      });

      expect(
        within(screen.getByRole('group', { name: 'Paquetes' })).getAllByRole('checkbox')
      ).toHaveLength(1);
      expect(
        within(screen.getByRole('group', { name: 'Servicios adicionales' })).getAllByRole(
          'checkbox'
        )
      ).toHaveLength(2);
    });
  });
});
