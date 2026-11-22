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
 * The customer picker has its own tests (spec 008 and 012): here it hands over a customer or a car.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { act, fireEvent, screen } from '@testing-library/react';

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
    customerLocked?: boolean;
    onCustomerChange: (customer: object) => void;
    onVehicleChange: (vehicle: object) => void;
  }) => (
    <div>
      {props.customerLocked && <p>Cliente fijo</p>}
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

const service = (id: string, name: string, price_car: number | null) => ({
  id,
  name,
  price_motorcycle: 25000,
  price_car,
  price_bicycle: null,
  estimated_minutes: null,
});

const renderForm = (
  props: { day?: AgendaDay; reservation?: ReservationSummary; initialStart?: string } = {}
) => {
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
  );
  renderWithProviders(wrap(<ReservationForm day={props.day ?? day()} {...props} />));
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

describe('ReservationForm', () => {
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
});
