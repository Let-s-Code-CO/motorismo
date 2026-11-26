/**
 * ReservationForm — «Nueva reserva» and changing one (spec 012, HU-01, CA-20).
 *
 * Guards:
 * - CA-01 / CA-05: with a customer and a slot (vehicle optional), saving books the seat and opens
 *   the reservation, where «Reserva guardada.» shows once it is reached (spec 013, CA-05): not in
 *   the address, so reloading does not repeat it.
 * - CA-04: the services offered are the active ones; with a vehicle, only those with a price for
 *   its type.
 * - The customer and the slot are required; nothing is sent without them.
 * - CA-06: a slot that filled up meanwhile is said, and the slots are reloaded.
 * - CA-10: another day reloads its slots through the URL, keeping the other parameters.
 * - CA-20: changing a reservation keeps its customer (the picker is locked) and sends its id.
 * - Spec 006, CA-10: without network nothing is reported and the form stays as it was.
 * - Spec 024, CA-23 to CA-25: what cannot go with the ticked services is disabled, saying why.
 * - Spec 024, CA-14: a service «a convenir» ticked asks for its time (5 to 1.440 minutes) and sends
 *   it; the total estimate counts it; a reservation being changed keeps the time it had.
 * The customer picker has its own tests (spec 008 and 012): here it hands over a customer or a car.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { act, fireEvent, screen, within } from '@testing-library/react';

import { arrive } from '@web/modules/core/lib/toast.lib';
import { saveReservation } from '@web/modules/reservations/actions/reservations.actions';
import ReservationForm from '@web/modules/reservations/components/organisms/reservation-form.component';
import type {
  AgendaDay,
  AgendaSlot,
  ReservationSummary,
} from '@web/modules/reservations/types/reservations.types';
import { fetchActiveServices } from '@web/modules/work-orders/api/work-orders.client';

import { inToasts, renderWithProviders } from '@tests/test-utils/render';

const router = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/agenda/new',
  useSearchParams: () => new URLSearchParams('date=2030-06-12&edit=1'),
}));
vi.mock('@web/modules/reservations/actions/reservations.actions', () => ({
  saveReservation: vi.fn(),
}));
vi.mock('@web/modules/work-orders/api/work-orders.client', () => ({
  fetchActiveServices: vi.fn(),
}));
vi.mock('@web/modules/work-orders/components/organisms/customer-picker.component', () => ({
  default: (props: {
    customer: { full_name: string } | null;
    customerLocked?: boolean;
    initialVehicleId?: string | null;
    onCustomerChange: (customer: object) => void;
    onVehicleChange: (vehicle: object) => void;
  }) => (
    <div>
      {props.customerLocked && <p>Cliente fijo</p>}
      {props.customer && <p>Cliente elegido: {props.customer.full_name}</p>}
      {props.initialVehicleId && <p>Vehículo inicial: {props.initialVehicleId}</p>}
      <button
        type="button"
        onClick={() =>
          props.onCustomerChange({ id: CUSTOMER, full_name: 'Camila', phone: null, email: null })
        }
      >
        Elegir cliente de prueba
      </button>
      <button
        type="button"
        onClick={() =>
          props.onVehicleChange({
            id: CAR,
            vehicle_type: 'car',
            plate: 'KDM482',
            brand_name: 'Mazda',
            line_name: 'CX-30',
            openOrder: null,
          })
        }
      >
        Elegir carro de prueba
      </button>
    </div>
  ),
}));

const NINE = '2030-06-12T09:00:00-05:00';
// The schema checks ids are UUIDs, as the database's are.
const CUSTOMER = '6f9c8d1e-2b3a-4c5d-8e7f-0a1b2c3d4e5f';
const CAR = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const WASH = '9e8d7c6b-5a4f-4e3d-9c2b-1a0f9e8d7c6b';
const CHAIN = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

const slot = (overrides: Partial<AgendaSlot> = {}): AgendaSlot => ({
  slot_start: NINE,
  slot_end: '2030-06-12T10:00:00-05:00',
  seats: 2,
  taken: 0,
  started: false,
  ...overrides,
});

const day = (overrides: Partial<AgendaDay> = {}): AgendaDay => ({
  date: '2030-06-12',
  state: 'open',
  slots: [slot()],
  reservations: [],
  ...overrides,
});

const PPF = '3c4d5e6f-7a8b-4c9d-8e0f-2a3b4c5d6e7f';

const service = (
  id: string,
  name: string,
  price_car: number | null,
  overrides: {
    price_motorcycle?: number | null;
    motorcycle_prices?: Record<string, number> | null;
    estimated_minutes?: number | null;
    on_quote?: boolean;
    includes?: string[];
  } = {}
) => ({
  id,
  name,
  price_motorcycle: 25000,
  motorcycle_prices: null,
  price_car,
  price_bicycle: null,
  estimated_minutes: null,
  on_quote: false,
  includes: [] as string[],
  ...overrides,
});

/** PPF (spec 024): for any vehicle, its value and time agreed each time. */
const ppf = () =>
  service(PPF, 'PPF', null, { price_motorcycle: null, on_quote: true, estimated_minutes: null });

const renderForm = (
  props: {
    day?: AgendaDay;
    reservation?: ReservationSummary;
    initialStart?: string;
    initialCustomer?: { id: string; full_name: string; phone: string | null; email: string | null };
    initialVehicleId?: string;
  } = {}
) => {
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
  );
  renderWithProviders(wrap(<ReservationForm day={props.day ?? day()} {...props} />));
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

describe('ReservationForm', () => {
  describe('agendar desde el cliente (amendment HU-07)', () => {
    it('starts with the customer it was opened for, and books them (CA-40)', async () => {
      vi.mocked(saveReservation).mockResolvedValue({ ok: true, id: 'r-new' });
      renderForm({
        initialCustomer: { id: CUSTOMER, full_name: 'Valentina', phone: null, email: null },
      });

      expect(screen.getByText('Cliente elegido: Valentina')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('radio', { name: /^9:00 a\. m\./ }));
      submit();

      await vi.waitFor(() =>
        expect(saveReservation).toHaveBeenCalledWith(
          expect.objectContaining({ customer_id: CUSTOMER, slot_start: NINE })
        )
      );
    });

    it('hands the vehicle it was opened for to the picker, which chooses it (CA-41)', () => {
      renderForm({
        initialCustomer: { id: CUSTOMER, full_name: 'Valentina', phone: null, email: null },
        initialVehicleId: CAR,
      });

      expect(screen.getByText(`Vehículo inicial: ${CAR}`)).toBeInTheDocument();
    });
  });

  beforeEach(() => {
    vi.mocked(fetchActiveServices).mockResolvedValue([
      service(WASH, 'Lavado detallado', 40000),
      service(CHAIN, 'Limpieza de cadena', null),
    ]);
  });
  afterEach(() => vi.clearAllMocks());

  it('books a customer without a vehicle in a slot, with services and notes, and opens the reservation (CA-01, CA-05)', async () => {
    vi.mocked(saveReservation).mockResolvedValue({ ok: true, id: 'r-new' });
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Elegir cliente de prueba' }));
    fireEvent.click(screen.getByRole('radio', { name: /9:00 a\. m\./ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Limpieza de cadena' }));
    fireEvent.change(screen.getByLabelText('Observaciones (opcional)'), {
      target: { value: 'Pidió por WhatsApp' },
    });
    submit();

    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith('/agenda/r-new'));
    expect(screen.queryByText('Reserva guardada.')).not.toBeInTheDocument();
    act(() => arrive('/agenda/r-new'));
    expect(inToasts().getByText('Reserva guardada.')).toBeVisible();
    expect(saveReservation).toHaveBeenCalledWith({
      customer_id: CUSTOMER,
      vehicle_id: null,
      slot_start: NINE,
      service_ids: [CHAIN],
      service_minutes: {},
      notes: 'Pidió por WhatsApp',
    });
  });

  it('offers every active service without a vehicle, and only those for a car once a car is chosen (CA-04)', async () => {
    renderForm();

    expect(await screen.findByRole('checkbox', { name: 'Limpieza de cadena' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir carro de prueba' }));

    expect(screen.getByRole('checkbox', { name: 'Lavado detallado' })).toBeVisible();
    expect(screen.queryByRole('checkbox', { name: 'Limpieza de cadena' })).not.toBeInTheDocument();
  });

  it('asks for the customer and the slot, and sends nothing without them', async () => {
    renderForm();
    submit();

    expect(await screen.findByText('Elige el cliente.')).toBeVisible();
    expect(screen.getByText('Elige una franja.')).toBeVisible();
    expect(saveReservation).not.toHaveBeenCalled();
  });

  it('says that the slot filled up meanwhile and reloads the slots (CA-06)', async () => {
    vi.mocked(saveReservation).mockResolvedValue({ ok: false, error: 'slotFull' });
    renderForm({ initialStart: NINE });

    fireEvent.click(screen.getByRole('button', { name: 'Elegir cliente de prueba' }));
    submit();

    expect(await screen.findByText('Esa franja se acaba de llenar. Elige otra.')).toBeVisible();
    expect(router.refresh).toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('reloads another day through the URL, keeping the other parameters (CA-10)', () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('Día'), { target: { value: '2030-06-13' } });

    expect(router.replace).toHaveBeenCalledWith('/agenda/new?date=2030-06-13&edit=1', {
      scroll: false,
    });
  });

  it('keeps the customer of a reservation being changed and sends its id (CA-20)', async () => {
    vi.mocked(saveReservation).mockResolvedValue({ ok: true, id: 'r1' });
    renderForm({
      reservation: {
        id: 'r1',
        customer_id: CUSTOMER,
        customer_name: 'Camila',
        customer_phone: null,
        vehicle_id: null,
        vehicle_type: null,
        slot_start: NINE,
        service_ids: [],
        notes: null,
      } as unknown as ReservationSummary,
    });

    expect(screen.getByText('Cliente fijo')).toBeVisible();
    submit();

    await vi.waitFor(() =>
      expect(saveReservation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r1', slot_start: NINE })
      )
    );
  });

  it('reports nothing without network, and keeps the form (spec 006, CA-10)', async () => {
    vi.mocked(saveReservation).mockRejectedValue(new TypeError('Failed to fetch'));
    renderForm({ initialStart: NINE });

    fireEvent.click(screen.getByRole('button', { name: 'Elegir cliente de prueba' }));
    submit();

    await vi.waitFor(() => expect(saveReservation).toHaveBeenCalled());
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /9:00 a\. m\./ })).toBeChecked();
  });

  describe('a service «a convenir» (spec 024, CA-14)', () => {
    beforeEach(() => {
      vi.mocked(fetchActiveServices).mockResolvedValue([
        service(WASH, 'Lavado detallado', 40000, { estimated_minutes: 90 }),
        ppf(),
      ]);
    });

    const minutesField = () => screen.getByLabelText('Tiempo de PPF (minutos)');

    it('asks for its time only once it is ticked', async () => {
      renderForm({ initialStart: NINE });

      fireEvent.click(await screen.findByRole('checkbox', { name: 'PPF' }));

      expect(minutesField()).toBeVisible();
      fireEvent.click(screen.getByRole('checkbox', { name: 'PPF' }));
      expect(screen.queryByLabelText('Tiempo de PPF (minutos)')).not.toBeInTheDocument();
    });

    it('sends nothing without its time, and says so under the field', async () => {
      renderForm({ initialStart: NINE });
      fireEvent.click(screen.getByRole('button', { name: 'Elegir cliente de prueba' }));
      fireEvent.click(await screen.findByRole('checkbox', { name: 'PPF' }));

      submit();

      expect(await screen.findByText('Escribe cuánto tiempo tomará.')).toBeVisible();
      expect(saveReservation).not.toHaveBeenCalled();
    });

    it('refuses a time outside 5 to 1.440 minutes (1.441 = more than a day)', async () => {
      renderForm({ initialStart: NINE });
      fireEvent.click(screen.getByRole('button', { name: 'Elegir cliente de prueba' }));
      fireEvent.click(await screen.findByRole('checkbox', { name: 'PPF' }));

      fireEvent.change(minutesField(), { target: { value: '1441' } });
      submit();

      expect(await screen.findByText('Escribe entre 5 y 1.440 minutos.')).toBeVisible();
      expect(saveReservation).not.toHaveBeenCalled();
    });

    it('sends its time by service, as minutes', async () => {
      vi.mocked(saveReservation).mockResolvedValue({ ok: true, id: 'r-new' });
      renderForm({ initialStart: NINE });
      fireEvent.click(screen.getByRole('button', { name: 'Elegir cliente de prueba' }));
      fireEvent.click(await screen.findByRole('checkbox', { name: 'PPF' }));

      fireEvent.change(minutesField(), { target: { value: '240' } });
      submit();

      await vi.waitFor(() =>
        expect(saveReservation).toHaveBeenCalledWith(
          expect.objectContaining({ service_ids: [PPF], service_minutes: { [PPF]: 240 } })
        )
      );
    });

    it('counts it in the estimate: 90 + 240 min = «≈ 5 h 30 min»', async () => {
      renderForm({ initialStart: NINE });
      fireEvent.click(await screen.findByRole('checkbox', { name: 'Lavado detallado' }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'PPF' }));

      // Without its time yet, PPF is named as not estimated.
      const estimate = () => document.querySelector<HTMLElement>('[data-booking-estimate]')!;
      expect(estimate()).toHaveTextContent('Sin estimar: PPF');
      fireEvent.change(minutesField(), { target: { value: '240' } });

      expect(estimate()).toHaveTextContent('Tiempo estimado: ≈ 5 h 30 min');
      expect(estimate()).not.toHaveTextContent('Sin estimar');
    });

    it('keeps the time it had in a reservation being changed (CA-20)', async () => {
      renderForm({
        reservation: {
          id: 'r1',
          customer_id: CUSTOMER,
          customer_name: 'Camila',
          customer_phone: null,
          vehicle_id: null,
          vehicle_type: null,
          slot_start: NINE,
          service_ids: [WASH, PPF],
          service_minutes: [null, 180],
          notes: null,
        } as unknown as ReservationSummary,
      });

      expect(await screen.findByLabelText('Tiempo de PPF (minutos)')).toHaveValue('180');
    });
  });

  describe('packages and what they include (spec 024, CA-23 to CA-25)', () => {
    const PREMIUM = '4d5e6f7a-8b9c-4d0e-9f1a-3b4c5d6e7f80';
    const DELUXE = '5e6f7a8b-9c0d-4e1f-8a2b-4c5d6e7f8091';
    const SELLADOR = '6f7a8b9c-0d1e-4f2a-9b3c-5d6e7f809102';
    const BY_CATEGORY = {
      street: 1,
      sbk: 1,
      scooter: 1,
      maxi_scooter: 1,
      trail: 1,
      maxi_trail: 1,
      cruiser: 1,
      maxi_cruiser: 1,
    };

    beforeEach(() => {
      vi.mocked(fetchActiveServices).mockResolvedValue([
        service(PREMIUM, 'Premium', null, {
          price_motorcycle: null,
          motorcycle_prices: BY_CATEGORY,
          includes: [SELLADOR],
        }),
        service(DELUXE, 'Deluxe', null, { price_motorcycle: null, motorcycle_prices: BY_CATEGORY }),
        service(SELLADOR, 'Sellador', null),
      ] as never);
    });

    it('disables what the ticked package includes and any other package, saying why', async () => {
      renderForm({ initialStart: NINE });

      fireEvent.click(await screen.findByRole('checkbox', { name: /^Premium/ }));

      expect(screen.getByRole('checkbox', { name: /^Sellador/ })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: /^Sellador/ })).toHaveAccessibleName(
        'Sellador Incluido en Premium'
      );
      expect(screen.getByRole('checkbox', { name: /^Deluxe/ })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: /^Deluxe/ })).toHaveAccessibleName(
        'Deluxe Ya hay un paquete: Premium'
      );
    });

    it('makes them available again once the package is unticked', async () => {
      renderForm({ initialStart: NINE });

      fireEvent.click(await screen.findByRole('checkbox', { name: /^Premium/ }));
      fireEvent.click(screen.getByRole('checkbox', { name: /^Premium/ }));

      expect(screen.getByRole('checkbox', { name: /^Sellador/ })).toBeEnabled();
      expect(screen.getByRole('checkbox', { name: /^Deluxe/ })).toBeEnabled();
    });

    it('groups the services: «Paquetes» apart from «Servicios adicionales» (CA-28)', async () => {
      renderForm({ initialStart: NINE });

      const packages = await screen.findByRole('group', { name: 'Paquetes' });
      expect(
        within(packages)
          .getAllByRole('checkbox')
          .map((box) => box.closest('label')!.textContent)
      ).toEqual(['Premium', 'Deluxe']);
      expect(
        within(screen.getByRole('group', { name: 'Servicios adicionales' }))
          .getAllByRole('checkbox')
          .map((box) => box.closest('label')!.textContent)
      ).toEqual(['Sellador']);
    });

    it('orders the packages from the cheapest up: Pro Wash, Premium, Deluxe, Supreme (CA-28)', async () => {
      const ladder = (lowest: number) => ({
        street: lowest + 2000,
        sbk: lowest + 4000,
        scooter: lowest,
        maxi_scooter: lowest + 4000,
        trail: lowest + 6000,
        maxi_trail: lowest + 10000,
        cruiser: lowest + 2000,
        maxi_cruiser: lowest + 6000,
      });
      const pkg = (id: string, name: string, lowest: number) =>
        service(id, name, null, { price_motorcycle: null, motorcycle_prices: ladder(lowest) });
      // As the catalog comes: by name.
      vi.mocked(fetchActiveServices).mockResolvedValue([
        pkg(DELUXE, 'Combo de lavado Deluxe', 170000),
        pkg('7a8b9c0d-1e2f-4a3b-8c4d-6e7f80910213', 'Combo de lavado Supreme', 700000),
        pkg('8b9c0d1e-2f3a-4b4c-9d5e-7f8091021324', 'Lavado Pro Wash', 42000),
        pkg(PREMIUM, 'Paquete de lavado Premium', 97000),
      ] as never);
      renderForm({ initialStart: NINE });

      const packages = await screen.findByRole('group', { name: 'Paquetes' });
      expect(
        within(packages)
          .getAllByRole('checkbox')
          .map((box) => box.closest('label')!.textContent)
      ).toEqual([
        'Lavado Pro Wash',
        'Paquete de lavado Premium',
        'Combo de lavado Deluxe',
        'Combo de lavado Supreme',
      ]);
    });
  });
});
