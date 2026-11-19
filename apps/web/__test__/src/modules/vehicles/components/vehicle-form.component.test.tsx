/**
 * VehicleForm — registering or correcting a vehicle (spec 005, HU-01; used by staff and by the
 * customer in "Mis vehículos").
 *
 * Guards:
 * - CA-02: the form opens with Motocicleta chosen and asks for brand, line, displacement, colour
 *   and plate; the class appears for Carro (Automóvil / Camioneta) and Bicicleta (Montaña / Ruta),
 *   never preselected (spec assumption);
 * - CA-06: a bicycle has no plate and no displacement, and its line is optional;
 * - CA-09: changing the type empties brand and line (a brand of one type is not of another), and
 *   changing the brand empties the line;
 * - CA-07: sending it incomplete shows the error next to each field and saves nothing;
 * - a valid vehicle is sent for the customer of the record, normalised (plate without separators).
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { saveVehicle } from '@web/modules/vehicles/actions/vehicles.actions';
import { fetchBrands, fetchLines } from '@web/modules/vehicles/api/vehicles.client';
import VehicleForm from '@web/modules/vehicles/components/organisms/vehicle-form.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/vehicles/actions/vehicles.actions', () => ({ saveVehicle: vi.fn() }));
vi.mock('@web/modules/vehicles/api/vehicles.client', () => ({
  fetchBrands: vi.fn(),
  fetchLines: vi.fn(),
}));

const CUSTOMER_ID = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

const withQueryClient = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const setup = (onSaved = vi.fn()) => {
  const view = renderWithProviders(
    withQueryClient({
      children: <VehicleForm customerId={CUSTOMER_ID} onSaved={onSaved} onCancel={vi.fn()} />,
    })
  );
  return { ...view, onSaved };
};

const typeGroup = () => screen.getByRole('radiogroup', { name: 'Tipo' });
const chooseType = (name: string) =>
  fireEvent.click(within(typeGroup()).getByRole('radio', { name }));
const brandInput = () => screen.getByRole('combobox', { name: /Marca/ });
const lineInput = () => screen.getByRole('combobox', { name: /Línea/ });

describe('VehicleForm', () => {
  beforeEach(() => {
    vi.mocked(fetchBrands).mockResolvedValue([
      { id: 'b-suzuki', name: 'Suzuki' },
      { id: 'b-yamaha', name: 'Yamaha' },
    ]);
    vi.mocked(fetchLines).mockResolvedValue([{ id: 'l-gsxr600', name: 'GSX-R600' }]);
    vi.mocked(saveVehicle).mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.clearAllMocks());

  it('opens with Motocicleta chosen, with displacement and plate and without class (CA-02)', () => {
    setup();

    expect(within(typeGroup()).getByRole('radio', { name: 'Motocicleta' })).toBeChecked();
    expect(brandInput()).toBeInTheDocument();
    expect(lineInput()).toBeInTheDocument();
    expect(screen.getByLabelText(/Cilindraje/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Placa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Color/ })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Clase' })).not.toBeInTheDocument();
  });

  it('asks a car for its class, Automóvil or Camioneta, with none preselected and no displacement', () => {
    setup();

    chooseType('Carro');

    const classGroup = screen.getByRole('radiogroup', { name: 'Clase' });
    const classes = within(classGroup).getAllByRole('radio');
    expect(classes.map((radio) => radio.getAttribute('value'))).toEqual(['automobile', 'utility']);
    expect(within(classGroup).getByRole('radio', { name: 'Automóvil' })).not.toBeChecked();
    expect(within(classGroup).getByRole('radio', { name: 'Camioneta' })).not.toBeChecked();
    expect(screen.queryByLabelText(/Cilindraje/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Placa' })).toBeInTheDocument();
  });

  it('asks a bicycle for Montaña or Ruta, without plate or displacement, line optional (CA-06)', () => {
    setup();

    chooseType('Bicicleta');

    const classGroup = screen.getByRole('radiogroup', { name: 'Clase' });
    expect(within(classGroup).getByRole('radio', { name: 'Montaña' })).not.toBeChecked();
    expect(within(classGroup).getByRole('radio', { name: 'Ruta' })).not.toBeChecked();
    expect(screen.queryByRole('textbox', { name: 'Placa' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cilindraje/)).not.toBeInTheDocument();
    expect(lineInput()).toHaveAccessibleName(/opcional/);
  });

  it('empties brand and line when the type changes, and the line when the brand changes (CA-09)', () => {
    setup();

    fireEvent.change(brandInput(), { target: { value: 'Suzuki' } });
    fireEvent.change(lineInput(), { target: { value: 'GSX-R600' } });
    fireEvent.change(brandInput(), { target: { value: 'Yamaha' } });
    expect(lineInput()).toHaveValue('');

    fireEvent.change(lineInput(), { target: { value: 'BWS FI' } });
    chooseType('Carro');
    expect(brandInput()).toHaveValue('');
    expect(lineInput()).toHaveValue('');
  });

  it('shows the error next to each missing field and saves nothing (CA-07)', async () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escribe la marca.')).toBeInTheDocument();
    expect(screen.getByText('Escribe la línea.')).toBeInTheDocument();
    expect(screen.getByText('Elige el color.')).toBeInTheDocument();
    expect(screen.getByText('Escribe la placa.')).toBeInTheDocument();
    expect(saveVehicle).not.toHaveBeenCalled();
  });

  it('rejects a plate in the shape of another type (CA-05)', async () => {
    setup();

    fireEvent.change(screen.getByRole('textbox', { name: 'Placa' }), {
      target: { value: 'ABC123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('La placa no tiene el formato de este tipo de vehículo.')
    ).toBeInTheDocument();
  });

  it('sends a valid vehicle for the customer of the record, normalised, and reports it saved', async () => {
    const { onSaved } = setup();

    fireEvent.change(brandInput(), { target: { value: 'Suzuki' } });
    fireEvent.change(lineInput(), { target: { value: 'GSX-R600' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Placa' }), {
      target: { value: 'uih 03d' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Color/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Negro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveVehicle).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: CUSTOMER_ID,
        vehicle_type: 'motorcycle',
        brand_name: 'Suzuki',
        line_name: 'GSX-R600',
        color: 'black',
        plate: 'UIH03D',
      })
    );
  });

  it('shows the database refusal, e.g. a plate already registered (CA-08)', async () => {
    vi.mocked(saveVehicle).mockResolvedValue({ ok: false, error: 'plateTaken' });
    setup();

    fireEvent.change(brandInput(), { target: { value: 'Suzuki' } });
    fireEvent.change(lineInput(), { target: { value: 'GSX-R600' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Placa' }), {
      target: { value: 'UIH03D' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Color/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Negro' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText('Ya hay un vehículo registrado con esta placa.')
    ).toBeInTheDocument();
  });
});
