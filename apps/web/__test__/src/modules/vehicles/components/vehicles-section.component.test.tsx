/**
 * VehiclesSection — the vehicles of a customer, on their record (staff) and in "Mi perfil" (the
 * customer) (spec 005).
 *
 * Guards:
 * - CA-01: staff see "Vehículos" with every active vehicle, or "Este cliente aún no tiene
 *   vehículos.", and "Agregar vehículo" opens the form;
 * - a disabled customer's vehicles are read-only: no "Agregar vehículo" (spec assumption);
 * - CA-20 / CA-21: each active vehicle can be corrected ("Editar") or retired ("Retirar", after a
 *   confirmation that says it cannot be undone);
 * - CA-22 / RF-06: staff see the retired vehicles apart, with their retirement date and no actions;
 * - CA-23 / CA-24: the customer sees "Mis vehículos" in second person and never the retired ones.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { retireVehicle } from '@web/modules/vehicles/actions/vehicles.actions';
import VehiclesSection from '@web/modules/vehicles/components/organisms/vehicles-section.component';

import { buildVehicle } from '@tests/test-utils/builders';
import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@web/modules/vehicles/actions/vehicles.actions', () => ({
  saveVehicle: vi.fn(),
  retireVehicle: vi.fn(),
}));
vi.mock('@web/modules/vehicles/api/vehicles.client', () => ({
  fetchBrands: vi.fn().mockResolvedValue([]),
  fetchLines: vi.fn().mockResolvedValue([]),
}));

const CUSTOMER_ID = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

const withQueryClient = (children: ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

type Props = Partial<Parameters<typeof VehiclesSection>[0]>;

const renderSection = (props: Props = {}) =>
  renderWithProviders(
    withQueryClient(
      <VehiclesSection
        customerId={CUSTOMER_ID}
        audience="staff"
        vehicles={[]}
        retired={[]}
        readOnly={false}
        {...props}
      />
    )
  );

describe('VehiclesSection — staff on a customer record', () => {
  it('says the customer has no vehicles yet and offers to add one (CA-01)', () => {
    renderSection();

    const section = screen.getByRole('region', { name: 'Vehículos' });
    expect(within(section).getByText('Este cliente aún no tiene vehículos.')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Agregar vehículo' })).toBeInTheDocument();
  });

  it('lists every active vehicle of the customer, in the given order (CA-01, CA-04)', () => {
    renderSection({
      vehicles: [
        buildVehicle({
          brand: { name: 'Mazda' },
          line: { name: 'CX-30' },
          vehicle_type: 'car',
          vehicle_class: 'utility',
          plate: 'KDM482',
          displacement_cc: null,
        }),
        buildVehicle(),
      ],
    });

    const items = within(screen.getByRole('list', { name: 'Vehículos' })).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Mazda CX-30');
    expect(items[1]).toHaveTextContent('Suzuki GSX-R600');
    expect(screen.queryByText('Este cliente aún no tiene vehículos.')).not.toBeInTheDocument();
  });

  it('opens the vehicle form from "Agregar vehículo"', async () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: 'Agregar vehículo' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radiogroup', { name: 'Tipo' })).toBeInTheDocument();
  });

  it('offers no way to add vehicles to a disabled customer (read-only)', () => {
    renderSection({ readOnly: true, vehicles: [buildVehicle()] });

    expect(screen.queryByRole('button', { name: 'Agregar vehículo' })).not.toBeInTheDocument();
    expect(
      screen.getByText('El cliente está desactivado: sus vehículos no se pueden cambiar.')
    ).toBeInTheDocument();
  });
});

describe('VehiclesSection — correcting and retiring (HU-05)', () => {
  afterEach(() => vi.clearAllMocks());

  it('offers to edit and to retire each active vehicle, naming it (CA-20, CA-21)', () => {
    renderSection({ vehicles: [buildVehicle()] });

    expect(screen.getByRole('button', { name: 'Editar Suzuki GSX-R600' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retirar Suzuki GSX-R600' })).toBeInTheDocument();
  });

  it('opens the form with the data of the vehicle to correct it (CA-20)', async () => {
    renderSection({ vehicles: [buildVehicle()] });

    fireEvent.click(screen.getByRole('button', { name: 'Editar Suzuki GSX-R600' }));

    const dialog = await screen.findByRole('dialog', { name: 'Editar vehículo' });
    expect(within(dialog).getByRole('combobox', { name: /Marca/ })).toHaveValue('Suzuki');
    expect(within(dialog).getByRole('textbox', { name: 'Placa' })).toHaveValue('UIH-03D');
  });

  it('retires a vehicle only after confirming that it cannot be undone (CA-21)', async () => {
    vi.mocked(retireVehicle).mockResolvedValue({ ok: true });
    const vehicle = buildVehicle();
    renderSection({ vehicles: [vehicle] });

    fireEvent.click(screen.getByRole('button', { name: 'Retirar Suzuki GSX-R600' }));
    const dialog = await screen.findByRole('dialog', { name: 'Retirar vehículo' });
    expect(dialog).toHaveTextContent('No se puede deshacer.');
    expect(retireVehicle).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Retirar' }));

    await waitFor(() => expect(retireVehicle).toHaveBeenCalledWith({ id: vehicle.id }));
    expect(await screen.findByText('Vehículo retirado.')).toBeInTheDocument();
  });

  it('shows staff the retired vehicles apart, with the date and without actions (CA-22, RF-06)', () => {
    renderSection({
      retired: [
        buildVehicle({
          brand: { name: 'Yamaha' },
          line: { name: 'BWS FI' },
          plate: 'JWJ07',
          retired_at: '2026-11-10T15:00:00.000Z',
        }),
      ],
    });

    const toggle = screen.getByRole('button', { name: 'Vehículos retirados (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);

    const retired = screen.getByRole('list', { name: 'Vehículos retirados (1)' });
    expect(retired).toHaveTextContent('Yamaha BWS FI');
    expect(retired).toHaveTextContent('Retirado el 10 de noviembre de 2026');
    expect(within(retired).queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('VehiclesSection — the customer in "Mi perfil" (HU-06)', () => {
  it('speaks to the customer and says they have no vehicles yet (CA-23)', () => {
    renderSection({ audience: 'customer' });

    const section = screen.getByRole('region', { name: 'Mis vehículos' });
    expect(within(section).getByText('Aún no tienes vehículos.')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Agregar vehículo' })).toBeInTheDocument();
  });

  it('never shows the customer their retired vehicles (CA-24)', () => {
    renderSection({
      audience: 'customer',
      vehicles: [buildVehicle()],
      retired: [
        buildVehicle({ brand: { name: 'Yamaha' }, retired_at: '2026-11-10T15:00:00.000Z' }),
      ],
    });

    expect(screen.queryByText(/Vehículos retirados/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Yamaha/)).not.toBeInTheDocument();
  });
});
