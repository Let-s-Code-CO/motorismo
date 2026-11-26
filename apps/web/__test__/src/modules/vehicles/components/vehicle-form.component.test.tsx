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
 * - CA-07: sending it incomplete shows the error next to each field (class and displacement
 *   included) and saves nothing;
 * - a valid vehicle is sent for the customer of the record, normalised (plate without separators);
 * - CA-30 (HU-07): only a car asks for "Ciudad de la placa", with Bogotá, D.C. already chosen (its
 *   own city when editing); each option shows its department; changing the type drops the city and
 *   coming back to Carro brings Bogotá, D.C. again (CA-09); a car without city shows the error
 *   next to the field (CA-07). The list shows at most 50 cities at a time (not virtualised, so
 *   it stays keyboard-accessible) and asks to type to find the rest.
 * - Spec 023, CA-08: a car registered with a city that issues no plates (not offered any more) is
 *   asked for its city again when corrected.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';

import { saveVehicle } from '@web/modules/vehicles/actions/vehicles.actions';
import {
  fetchBrands,
  fetchLines,
  fetchMunicipalities,
} from '@web/modules/vehicles/api/vehicles.client';
import VehicleForm from '@web/modules/vehicles/components/organisms/vehicle-form.component';

import { buildVehicle } from '@tests/test-utils/builders';
import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/vehicles/actions/vehicles.actions', () => ({ saveVehicle: vi.fn() }));
vi.mock('@web/modules/vehicles/api/vehicles.client', () => ({
  fetchBrands: vi.fn(),
  fetchLines: vi.fn(),
  fetchMunicipalities: vi.fn(),
}));

const CUSTOMER_ID = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

const withQueryClient = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

const setup = (onSaved = vi.fn(), vehicle?: Parameters<typeof VehicleForm>[0]['vehicle']) => {
  const view = renderWithProviders(
    withQueryClient({
      children: (
        <VehicleForm
          customerId={CUSTOMER_ID}
          vehicle={vehicle}
          onSaved={onSaved}
          onCancel={vi.fn()}
        />
      ),
    })
  );
  return { ...view, onSaved };
};

const typeGroup = () => screen.getByRole('radiogroup', { name: 'Tipo' });
const chooseType = (name: string) =>
  fireEvent.click(within(typeGroup()).getByRole('radio', { name }));
const brandInput = () => screen.getByRole('combobox', { name: /Marca/ });
const lineInput = () => screen.getByRole('combobox', { name: /Línea/ });
const cityInput = () => screen.getByRole('combobox', { name: /Ciudad de la placa/ });
const queryCityInput = () => screen.queryByRole('combobox', { name: /Ciudad de la placa/ });

describe('VehicleForm', () => {
  beforeEach(() => {
    vi.mocked(fetchBrands).mockResolvedValue([
      { id: 'b-suzuki', name: 'Suzuki' },
      { id: 'b-yamaha', name: 'Yamaha' },
    ]);
    vi.mocked(fetchLines).mockResolvedValue([{ id: 'l-gsxr600', name: 'GSX-R600' }]);
    // Unsorted on purpose: the form puts Bogotá, D.C., La Calera and Funza first.
    vi.mocked(fetchMunicipalities).mockResolvedValue([
      { code: '05001', name: 'Medellín', department: 'Antioquia' },
      { code: '25286', name: 'Funza', department: 'Cundinamarca' },
      { code: '05059', name: 'Armenia', department: 'Antioquia' },
      { code: '25377', name: 'La Calera', department: 'Cundinamarca' },
      { code: '11001', name: 'Bogotá, D.C.', department: 'Bogotá, D.C.' },
      { code: '63001', name: 'Armenia', department: 'Quindío' },
    ]);
    vi.mocked(saveVehicle).mockResolvedValue({ ok: true, id: 'vehicle-id' });
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

  it('shows "Elige la clase." next to the class of a car sent without one (CA-07)', async () => {
    setup();

    chooseType('Carro');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const classGroup = screen.getByRole('radiogroup', { name: 'Clase' });
    expect(await within(classGroup).findByText('Elige la clase.')).toBeInTheDocument();
    expect(saveVehicle).not.toHaveBeenCalled();
  });

  it('shows the displacement range next to a displacement of 49 cc (CA-07, RN-09)', async () => {
    setup();

    const displacement = screen.getByLabelText(/Cilindraje/);
    fireEvent.change(displacement, { target: { value: '49' } });
    fireEvent.blur(displacement);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('El cilindraje va de 50 a 2.500 cc.')).toBeInTheDocument();
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

    // With the vehicle's id: a work order picks the vehicle just registered (spec 008, CA-02).
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('vehicle-id'));
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

  it('asks only a car for "Ciudad de la placa", with Bogotá, D.C. already chosen (CA-02, CA-30)', async () => {
    setup();

    expect(queryCityInput()).not.toBeInTheDocument();
    chooseType('Bicicleta');
    expect(queryCityInput()).not.toBeInTheDocument();

    chooseType('Carro');
    await waitFor(() => expect(cityInput()).toHaveValue('Bogotá, D.C.'));
  });

  it('lists Bogotá, D.C., La Calera and Funza first, then the rest with their department (CA-30)', async () => {
    setup();

    chooseType('Carro');
    await waitFor(() => expect(cityInput()).toHaveValue('Bogotá, D.C.'));
    // The user types in the focused field: erasing the text opens the whole list. (Taken before
    // focusing: the open list hides the rest of the form from assistive technologies.)
    const input = cityInput();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '' } });

    const options = within(await screen.findByRole('listbox')).getAllByRole('option');
    expect(options.slice(0, 3).map((option) => option.textContent)).toEqual([
      expect.stringContaining('Bogotá, D.C.'),
      expect.stringContaining('La Calera'),
      expect.stringContaining('Funza'),
    ]);
    // A repeated name is told apart by its department.
    expect(options.map((option) => option.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Armenia.*Antioquia/),
        expect.stringMatching(/Armenia.*Quindío/),
      ])
    );
  });

  it('lists at most 50 cities and asks to type for the rest (the full list is 1,104)', async () => {
    vi.mocked(fetchMunicipalities).mockResolvedValue(
      Array.from({ length: 60 }, (_, index) => ({
        code: String(10000 + index),
        name: `Municipio ${String(index).padStart(2, '0')}`,
        department: 'Departamento',
      }))
    );
    setup();

    chooseType('Carro');
    const input = cityInput();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: 'municipio' } });

    // The cities arrive after the list opens: wait for them.
    await waitFor(() =>
      expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(50)
    );
    expect(screen.getByText('Escribe para ver más ciudades.')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'municipio 59' } });
    await waitFor(() =>
      expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1)
    );
    expect(screen.queryByText('Escribe para ver más ciudades.')).not.toBeInTheDocument();
  });

  it('keeps a chosen city beyond the first 50 among the options, first, so it stays chosen (Medellín)', async () => {
    const many = Array.from({ length: 60 }, (_, index) => ({
      code: String(10000 + index),
      name: `Abc ${String(index).padStart(2, '0')}`,
      department: 'Departamento',
    }));
    vi.mocked(fetchMunicipalities).mockResolvedValue([
      ...many,
      { code: '05001', name: 'Medellín', department: 'Antioquia' },
    ]);
    setup(
      vi.fn(),
      buildVehicle({
        vehicle_type: 'car',
        vehicle_class: 'utility',
        displacement_cc: null,
        plate: 'KDM482',
        plate_city_code: '05001',
        plate_city: { name: 'Medellín', plate_legend: null },
      })
    );
    await waitFor(() => expect(cityInput()).toHaveValue('Medellín'));

    const input = cityInput();
    act(() => input.focus());
    const options = await within(await screen.findByRole('listbox')).findAllByRole('option');
    expect(options[0]).toHaveTextContent('Medellín');
    expect(options).toHaveLength(50);

    act(() => input.blur());
    expect(input).toHaveValue('Medellín');
  });

  it("shows a car's own plate city when correcting it (CA-20, CA-30)", async () => {
    setup(
      vi.fn(),
      buildVehicle({
        vehicle_type: 'car',
        vehicle_class: 'utility',
        displacement_cc: null,
        brand: { name: 'Mazda' },
        line: { name: 'CX-30' },
        plate: 'KDM482',
        plate_city_code: '05001',
        plate_city: { name: 'Medellín', plate_legend: null },
      })
    );

    await waitFor(() => expect(cityInput()).toHaveValue('Medellín'));
  });

  it('asks again for the city of a car registered with one that issues no plates (spec 023, CA-08)', async () => {
    // San Antonio del Tequendama is not among the cities offered: it has no transit authority.
    setup(
      vi.fn(),
      buildVehicle({
        vehicle_type: 'car',
        vehicle_class: 'utility',
        displacement_cc: null,
        brand: { name: 'Mazda' },
        line: { name: 'CX-30' },
        plate: 'KDM482',
        plate_city_code: '25645',
        plate_city: { name: 'San Antonio del Tequendama', plate_legend: null },
      })
    );
    // Once the cities that issue plates have loaded, the field is empty.
    await waitFor(() => expect(fetchMunicipalities).toHaveBeenCalled());
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Elige la ciudad de la placa.')).toBeInTheDocument();
    expect(cityInput()).toHaveValue('');
    expect(saveVehicle).not.toHaveBeenCalled();
  });

  it('drops the city when the type changes and brings Bogotá, D.C. back with Carro (CA-09)', async () => {
    setup();

    chooseType('Carro');
    await waitFor(() => expect(cityInput()).toHaveValue('Bogotá, D.C.'));
    chooseType('Motocicleta');
    expect(queryCityInput()).not.toBeInTheDocument();

    chooseType('Carro');
    await waitFor(() => expect(cityInput()).toHaveValue('Bogotá, D.C.'));
  });

  it('shows "Elige la ciudad de la placa." next to the city of a car sent without one (CA-07)', async () => {
    setup();

    chooseType('Carro');
    await waitFor(() => expect(cityInput()).toHaveValue('Bogotá, D.C.'));
    fireEvent.change(cityInput(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Elige la ciudad de la placa.')).toBeInTheDocument();
    expect(saveVehicle).not.toHaveBeenCalled();
  });

  it('sends a car with the code of its plate city, Bogotá, D.C. (11001) by default (RN-11)', async () => {
    const { onSaved } = setup();

    chooseType('Carro');
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Clase' })).getByRole('radio', {
        name: 'Automóvil',
      })
    );
    fireEvent.change(brandInput(), { target: { value: 'Mazda' } });
    fireEvent.change(lineInput(), { target: { value: 'Mazda 3' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Placa' }), {
      target: { value: 'abc 123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Color/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Rojo' }));
    await waitFor(() => expect(cityInput()).toHaveValue('Bogotá, D.C.'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ vehicle_type: 'car', plate: 'ABC123', plate_city_code: '11001' })
    );
  });
});
