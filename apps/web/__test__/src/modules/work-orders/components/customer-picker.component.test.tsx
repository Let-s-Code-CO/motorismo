/**
 * CustomerPicker — the first step of «Nueva orden»: who brings which vehicle (spec 008, HU-01).
 *
 * Guards:
 * - CA-01: staff find the customer by name, phone or plate, and then see their active vehicles.
 * - RN-10: a customer with only one vehicle has it already chosen.
 * - CA-02: a vehicle not registered yet is registered right there and comes out chosen.
 * - A vehicle that already has an open order is not chosen again: its order is offered instead.
 *
 * For a reservation (spec 012, HU-01) the same picker, with three differences:
 * - CA-01: the vehicle is optional («Sin vehículo»); the only one still comes chosen (RN-10).
 * - A vehicle with an open order today can be booked for another time.
 * - CA-02: a customer not registered yet is registered right there (without account) and chosen.
 *
 * Spec 022, HU-01: «Registrar cliente» is there for an order too, always under the search (CA-01),
 * with the same «Nuevo cliente» form (CA-02) given what was searched (CA-04); saving chooses the
 * customer, cancelling leaves the search as it was (CA-03), and the vehicle registered with them is
 * chosen, for an order and for a reservation (CA-08, CA-09: their only vehicle, RN-10).
 */
import type { ReactNode } from 'react';
import { useState } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fireEvent, screen } from '@testing-library/react';

import {
  fetchCustomerVehicles,
  searchCustomers,
} from '@web/modules/work-orders/api/work-orders.client';
import CustomerPicker from '@web/modules/work-orders/components/organisms/customer-picker.component';
import type {
  PickerCustomer,
  PickerVehicle,
} from '@web/modules/work-orders/types/work-orders.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/work-orders/api/work-orders.client', () => ({
  searchCustomers: vi.fn(),
  fetchCustomerVehicles: vi.fn(),
}));
// The customer form has its own tests (spec 004, spec 022): here it shows what it was given to
// prefill, reports the new customer or is cancelled.
vi.mock('@web/modules/customers/components/organisms/customer-form.component', () => ({
  default: ({
    onSaved,
    onCancel,
    initialSearch,
  }: {
    onSaved: (customer: object) => void;
    onCancel: () => void;
    initialSearch?: string;
  }) => (
    <div>
      <p>Búsqueda recibida: {initialSearch ?? '—'}</p>
      <button
        type="button"
        onClick={() =>
          onSaved({
            id: 'customer-new',
            full_name: 'Wendy Walkin',
            email: null,
            phone: '3001234567',
          })
        }
      >
        Guardar cliente de prueba
      </button>
      <button type="button" onClick={onCancel}>
        Cancelar de prueba
      </button>
    </div>
  ),
}));
// The vehicle form has its own tests (spec 005): here it only reports the new vehicle's id.
vi.mock('@web/modules/vehicles/components/organisms/vehicle-form.component', () => ({
  default: ({ onSaved }: { onSaved: (id: string) => void }) => (
    <button type="button" onClick={() => onSaved('vehicle-new')}>
      Guardar vehículo de prueba
    </button>
  ),
}));

const camila: PickerCustomer = {
  id: 'customer-1',
  full_name: 'Camila Cliente',
  phone: '3001234567',
  email: 'cliente@motorismo.test',
};

const vehicle = (overrides: Partial<PickerVehicle> = {}): PickerVehicle => ({
  id: 'vehicle-1',
  vehicle_type: 'motorcycle',
  plate: 'UIH03D',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  openOrder: null,
  ...overrides,
});

const renderPicker = (
  customer: PickerCustomer | null = null,
  purpose: 'order' | 'reservation' = 'order',
  vehicleId: string | null = null,
  initialVehicleId: string | null = null
) => {
  const onCustomerChange = vi.fn();
  const onVehicleChange = vi.fn();
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
  );
  renderWithProviders(
    wrap(
      <CustomerPicker
        customer={customer}
        vehicleId={vehicleId}
        purpose={purpose}
        initialVehicleId={initialVehicleId}
        onCustomerChange={onCustomerChange}
        onVehicleChange={onVehicleChange}
      />
    )
  );
  return { onCustomerChange, onVehicleChange };
};

describe('CustomerPicker', () => {
  afterEach(() => vi.clearAllMocks());

  it('finds a customer by what staff type and hands them over (CA-01)', async () => {
    vi.mocked(searchCustomers).mockResolvedValue([camila]);
    const { onCustomerChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'uih' } });
    fireEvent.click(await screen.findByRole('button', { name: /Camila Cliente/ }));

    expect(searchCustomers).toHaveBeenCalledWith('uih');
    expect(onCustomerChange).toHaveBeenCalledWith(camila);
  });

  it('shows, on the right, the plate a result matched by, and none when it matched by name (spec 022, CA-11)', async () => {
    vi.mocked(searchCustomers).mockResolvedValue([
      { ...camila, matchedPlate: { plate: 'UIH03D', city: null, legend: null } },
      {
        id: 'customer-2',
        full_name: 'Gabriel Gómez',
        phone: null,
        email: null,
        matchedPlate: null,
      },
    ]);
    renderPicker();

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'uih' } });

    const camilaRow = await screen.findByRole('button', { name: /Camila Cliente/ });
    // The whole plate: a motorcycle's says COLOMBIA under its characters.
    const plate = camilaRow.querySelector<HTMLElement>('[data-plate]');
    expect(plate).toHaveTextContent('UIH-03D');
    expect(plate?.dataset.legend).toBe('COLOMBIA');
    expect(
      screen.getByRole('button', { name: /Gabriel Gómez/ }).querySelector('[data-plate]')
    ).toBeNull();
  });

  it('chooses the only vehicle of a customer by itself (CA-01, RN-10)', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([vehicle()]);
    const { onVehicleChange } = renderPicker(camila);

    expect(await screen.findByRole('radio', { name: /Suzuki GSX-R600 · UIH-03D/ })).toBeVisible();
    await vi.waitFor(() => expect(onVehicleChange).toHaveBeenCalledWith(vehicle()));
  });

  it('lets staff choose among several vehicles (nothing chosen for them)', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([
      vehicle(),
      vehicle({ id: 'vehicle-2', brand_name: 'Yamaha', line_name: 'BWS FI', plate: 'JWJ07' }),
    ]);
    const { onVehicleChange } = renderPicker(camila);

    fireEvent.click(await screen.findByRole('radio', { name: /Yamaha BWS FI · JWJ-07/ }));

    expect(onVehicleChange).toHaveBeenCalledTimes(1);
    expect(onVehicleChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'vehicle-2' }));
  });

  it('offers the open order of a vehicle that already has one, instead of choosing it', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([
      vehicle({ openOrder: { id: 'order-4', number: 4 } }),
    ]);
    const { onVehicleChange } = renderPicker(camila);

    expect(await screen.findByRole('link', { name: 'Orden #4' })).toHaveAttribute(
      'href',
      '/orders/order-4'
    );
    expect(screen.getByRole('radio', { name: /Suzuki GSX-R600/ })).toBeDisabled();
    expect(onVehicleChange).not.toHaveBeenCalled();
  });

  it('registers a vehicle right there, and chooses it (CA-02)', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValueOnce([]);
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([vehicle({ id: 'vehicle-new' })]);
    const { onVehicleChange } = renderPicker(camila);

    expect(await screen.findByText('Este cliente no tiene vehículos activos.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar vehículo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar vehículo de prueba' }));

    await vi.waitFor(() =>
      expect(onVehicleChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'vehicle-new' }))
    );
  });
});

describe('CustomerPicker for a reservation (spec 012)', () => {
  afterEach(() => vi.clearAllMocks());

  it('still chooses the only vehicle by itself, and lets staff leave it out (CA-01, RN-10)', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([vehicle()]);
    const { onVehicleChange } = renderPicker(camila, 'reservation', 'vehicle-1');

    fireEvent.click(
      await screen.findByRole('radio', { name: 'Sin vehículo (aún no sabe cuál traerá)' })
    );

    expect(onVehicleChange).toHaveBeenLastCalledWith(null);
  });

  it('lets a vehicle with an open order be booked for another time', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([
      vehicle({ openOrder: { id: 'order-4', number: 4 } }),
    ]);
    const { onVehicleChange } = renderPicker(camila, 'reservation');

    expect(await screen.findByRole('radio', { name: /Suzuki GSX-R600/ })).toBeEnabled();
    expect(screen.queryByRole('link', { name: 'Orden #4' })).not.toBeInTheDocument();
    await vi.waitFor(() =>
      expect(onVehicleChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'vehicle-1' }))
    );
  });

  it('registers a customer without account right there, and chooses them (CA-02)', async () => {
    vi.mocked(searchCustomers).mockResolvedValue([]);
    const { onCustomerChange } = renderPicker(null, 'reservation');

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'wendy' } });
    expect(await screen.findByText('No se encontró ningún cliente activo.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar cliente de prueba' }));

    await vi.waitFor(() =>
      expect(onCustomerChange).toHaveBeenCalledWith({
        id: 'customer-new',
        full_name: 'Wendy Walkin',
        email: null,
        phone: '3001234567',
      })
    );
  });

  it('offers no «Sin vehículo» for an order, nor registering a customer once one is chosen', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([vehicle()]);
    renderPicker(camila);

    expect(await screen.findByRole('radio', { name: /Suzuki GSX-R600/ })).toBeVisible();
    expect(screen.queryByRole('radio', { name: /Sin vehículo/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar cliente' })).not.toBeInTheDocument();
  });
});

describe('CustomerPicker from a reservation that arrived (spec 012, CA-12)', () => {
  afterEach(() => vi.clearAllMocks());

  it("chooses the reservation's vehicle among several, once they load", async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([
      vehicle(),
      vehicle({ id: 'vehicle-2', brand_name: 'Yamaha', line_name: 'BWS FI', plate: 'JWJ07' }),
    ]);
    const { onVehicleChange } = renderPicker(camila, 'order', null, 'vehicle-2');

    await vi.waitFor(() =>
      expect(onVehicleChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'vehicle-2' }))
    );
  });

  it('does not choose it for a new order if it already has one open (that order takes it)', async () => {
    vi.mocked(fetchCustomerVehicles).mockResolvedValue([
      vehicle({ openOrder: { id: 'order-4', number: 4 } }),
      vehicle({ id: 'vehicle-2', plate: 'JWJ07' }),
    ]);
    const { onVehicleChange } = renderPicker(camila, 'order', null, 'vehicle-1');

    // The only free vehicle is chosen instead (RN-10).
    await vi.waitFor(() =>
      expect(onVehicleChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'vehicle-2' }))
    );
    expect(onVehicleChange).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'vehicle-1' }));
  });
});

describe('CustomerPicker registering the customer it did not find (spec 022)', () => {
  afterEach(() => vi.clearAllMocks());

  it('offers «Registrar cliente» for an order too, with what was searched (CA-01, CA-02, CA-04)', async () => {
    vi.mocked(searchCustomers).mockResolvedValue([]);
    const { onCustomerChange } = renderPicker(null, 'order');

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'wendy' } });
    // The link sits in the sentence that says nobody was found.
    expect(await screen.findByText('No se encontró ningún cliente activo.')).toContainElement(
      screen.getByRole('button', { name: 'Registrar cliente' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));

    expect(await screen.findByText('Búsqueda recibida: wendy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cliente de prueba' }));
    await vi.waitFor(() =>
      expect(onCustomerChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'customer-new' }))
    );
  });

  it('keeps «Registrar cliente» at hand even when the search finds someone (corrected assumption)', async () => {
    vi.mocked(searchCustomers).mockResolvedValue([camila]);
    renderPicker(null, 'order');

    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'camila' } });

    expect(await screen.findByRole('button', { name: /Camila Cliente/ })).toBeVisible();
    // A link in a quiet sentence under the results, not a button of its own.
    expect(screen.getByText('¿Es un cliente nuevo?')).toContainElement(
      screen.getByRole('button', { name: 'Registrar cliente' })
    );
  });

  it('leaves the search as it was when the registration is cancelled (CA-03)', async () => {
    vi.mocked(searchCustomers).mockResolvedValue([]);
    const { onCustomerChange } = renderPicker(null, 'order');
    fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'wendy' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar cliente' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar de prueba' }));

    await vi.waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Guardar cliente de prueba' })
      ).not.toBeInTheDocument()
    );
    expect(screen.getByLabelText('Buscar cliente')).toHaveValue('wendy');
    expect(onCustomerChange).not.toHaveBeenCalled();
  });

  /** A screen that keeps what the picker chooses, as «Nueva orden» and the reservation form do. */
  const Host = ({
    purpose,
    onVehicle,
  }: {
    purpose: 'order' | 'reservation';
    onVehicle: (vehicle: PickerVehicle | null) => void;
  }) => {
    const [customer, setCustomer] = useState<PickerCustomer | null>(null);
    const [vehicleId, setVehicleId] = useState<string | null>(null);
    return (
      <QueryClientProvider client={new QueryClient()}>
        <CustomerPicker
          customer={customer}
          vehicleId={vehicleId}
          purpose={purpose}
          onCustomerChange={setCustomer}
          onVehicleChange={(chosen) => {
            setVehicleId(chosen?.id ?? null);
            onVehicle(chosen);
          }}
        />
      </QueryClientProvider>
    );
  };

  it.each(['order', 'reservation'] as const)(
    'chooses the new customer and the vehicle registered with them, for a(n) %s (CA-08, CA-09)',
    async (purpose) => {
      vi.mocked(searchCustomers).mockResolvedValue([]);
      // The customer just registered has one vehicle: the one registered with them.
      vi.mocked(fetchCustomerVehicles).mockResolvedValue([vehicle({ id: 'vehicle-new' })]);
      const onVehicle = vi.fn();
      renderWithProviders(<Host purpose={purpose} onVehicle={onVehicle} />);

      fireEvent.change(screen.getByLabelText('Buscar cliente'), { target: { value: 'wendy' } });
      fireEvent.click(await screen.findByRole('button', { name: 'Registrar cliente' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Guardar cliente de prueba' }));

      expect(await screen.findByText('Wendy Walkin')).toBeVisible();
      expect(fetchCustomerVehicles).toHaveBeenCalledWith('customer-new');
      await vi.waitFor(() =>
        expect(onVehicle).toHaveBeenCalledWith(expect.objectContaining({ id: 'vehicle-new' }))
      );
    }
  );
});
