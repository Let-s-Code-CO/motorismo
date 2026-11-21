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
 */
import type { ReactNode } from 'react';

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
// The customer form has its own tests (spec 004): here it only reports the new customer.
vi.mock('@web/modules/customers/components/organisms/customer-form.component', () => ({
  default: ({ onSaved }: { onSaved: (customer: object) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSaved({ id: 'customer-new', full_name: 'Wendy Walkin', email: null, phone: '3001234567' })
      }
    >
      Guardar cliente de prueba
    </button>
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

  it('offers neither «Sin vehículo» nor registering a customer for an order', async () => {
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
