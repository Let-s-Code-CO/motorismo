/**
 * CustomerForm — staff register and edit customers at the counter (spec 004, HU-06).
 *
 * Guards:
 * - CA-24: a customer is registered with a name and at least an email or a phone, once staff
 *   confirm the customer's consent; the screen gets the new customer (spec 012, CA-02: a
 *   reservation chooses it).
 * - CA-25: invalid input, missing contact or missing consent are reported next to each field and
 *   nothing is sent.
 * - CA-26: the "email already in use" refusal from the database is shown.
 * - CA-27: editing changes name, phone and — only without account — email; the email of a customer
 *   with an account is read-only and explains why.
 * - Spec 006, CA-10: if the network drops while sending, nothing is reported (neither success nor
 *   an error of its own: the app-wide «Sin conexión» notice speaks) and what was typed stays, to
 *   send again once the network is back.
 * - Spec 022, HU-02: an optional «Primer vehículo» with the vehicle's own fields and rules (CA-05);
 *   without it only the customer is sent (CA-06); with it both go together, the vehicle checked
 *   before sending, and a plate already taken shows under «Placa» (CA-07).
 * - Spec 022, CA-04: what staff searched lands in its field (a mobile, a plate, a name).
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { createCustomer, updateCustomer } from '@web/modules/customers/actions/customers.actions';
import CustomerForm from '@web/modules/customers/components/organisms/customer-form.component';
import { markOffline } from '@web/modules/pwa/utils/connection.lib';
import { fetchBrands, fetchLines } from '@web/modules/vehicles/api/vehicles.client';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/pwa/utils/connection.lib', () => ({ markOffline: vi.fn() }));
vi.mock('@web/modules/customers/actions/customers.actions', () => ({
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
}));
vi.mock('@web/modules/vehicles/api/vehicles.client', () => ({
  fetchBrands: vi.fn(),
  fetchLines: vi.fn(),
  fetchMunicipalities: vi.fn(),
}));

const type = (label: RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('CustomerForm (new customer)', () => {
  afterEach(() => vi.clearAllMocks());

  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));

  it('reports a missing name, missing contact and missing consent, and sends nothing (CA-25)', async () => {
    renderWithProviders(<CustomerForm mode="create" onSaved={vi.fn()} />);

    submit();

    expect(await screen.findByText('Introduce el nombre.')).toBeVisible();
    expect(screen.getByText('Indica al menos un correo o un celular.')).toBeVisible();
    expect(
      screen.getByText('Confirma que el cliente autorizó el tratamiento de sus datos.')
    ).toBeVisible();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('registers the customer with the normalised data and hands the new customer to the screen (CA-24; spec 012, CA-02)', async () => {
    vi.mocked(createCustomer).mockResolvedValue({ ok: true, id: 'customer-new' });
    const onSaved = vi.fn();
    renderWithProviders(<CustomerForm mode="create" onSaved={onSaved} />);

    type(/Nombre/, 'Marta Mostrador');
    type(/Celular/, '312 000 1111');
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente autorizó/ }));
    submit();

    // A reservation chooses the customer it has just registered (spec 012, CA-02).
    await vi.waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith({
        id: 'customer-new',
        full_name: 'Marta Mostrador',
        email: null,
        phone: '3120001111',
      })
    );
    expect(createCustomer).toHaveBeenCalledWith({
      full_name: 'Marta Mostrador',
      email: null,
      phone: '3120001111',
      data_consent: true,
    });
  });

  it('shows the duplicate-email refusal (CA-26)', async () => {
    vi.mocked(createCustomer).mockResolvedValue({ ok: false, error: 'emailTaken' });
    renderWithProviders(<CustomerForm mode="create" onSaved={vi.fn()} />);

    type(/Nombre/, 'Marta');
    type(/Correo/, 'cliente@motorismo.test');
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente autorizó/ }));
    submit();

    expect(await screen.findByText('Ya existe una cuenta con este correo.')).toBeVisible();
  });

  it('reports nothing and keeps what was typed when the network drops while sending (spec 006, CA-10)', async () => {
    vi.mocked(createCustomer).mockRejectedValue(new TypeError('Failed to fetch'));
    const onSaved = vi.fn();
    renderWithProviders(<CustomerForm mode="create" onSaved={onSaved} />);

    type(/Nombre/, 'Marta Mostrador');
    type(/Celular/, '312 000 1111');
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente autorizó/ }));
    submit();

    await vi.waitFor(() => expect(markOffline).toHaveBeenCalled());
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveValue('Marta Mostrador');
    expect(screen.getByLabelText(/Celular/)).toHaveValue('312 000 1111');
    expect(screen.getByRole('button', { name: 'Registrar cliente' })).toBeEnabled();
  });
});

describe('CustomerForm (edit)', () => {
  afterEach(() => vi.clearAllMocks());

  const defaults = { full_name: 'Marta M.', email: 'marta@correo.test', phone: '3120001111' };
  const save = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  it('sends the changes of a customer without account, email included (CA-27)', async () => {
    vi.mocked(updateCustomer).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    renderWithProviders(
      <CustomerForm
        mode="edit"
        customerId="c-1"
        defaults={defaults}
        emailLocked={false}
        onSaved={onSaved}
      />
    );

    expect(screen.getByLabelText(/Celular/)).toHaveValue('312 000 1111');
    type(/Correo/, 'marta.m@correo.test');
    save();

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateCustomer).toHaveBeenCalledWith({
      id: 'c-1',
      full_name: 'Marta M.',
      email: 'marta.m@correo.test',
      phone: '3120001111',
    });
  });

  it('shows the email of a customer with account as read-only, with the reason (CA-27, RN-10)', () => {
    renderWithProviders(
      <CustomerForm
        mode="edit"
        customerId="c-1"
        defaults={defaults}
        emailLocked
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Correo/)).toHaveAttribute('readonly');
    expect(
      screen.getByText('Es el correo con el que entra a su cuenta: no se puede cambiar.')
    ).toBeVisible();
  });
});

describe('CustomerForm (new customer with their first vehicle, spec 022)', () => {
  beforeEach(() => {
    vi.mocked(fetchBrands).mockResolvedValue([{ id: 'b-suzuki', name: 'Suzuki' }]);
    vi.mocked(fetchLines).mockResolvedValue([{ id: 'l-gsxr600', name: 'GSX-R600' }]);
  });
  afterEach(() => vi.clearAllMocks());

  const withQueryClient = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
  const setup = (props: { initialSearch?: string } = {}) => {
    const onSaved = vi.fn();
    renderWithProviders(
      withQueryClient({
        children: <CustomerForm mode="create" onSaved={onSaved} {...props} />,
      })
    );
    return { onSaved };
  };
  const withVehicle = () =>
    screen.getByRole('checkbox', { name: 'Registrar también su primer vehículo' });
  const vehiclePart = () => screen.getByRole('group', { name: 'Primer vehículo' });
  const plate = () => within(vehiclePart()).getByRole('textbox', { name: 'Placa' });
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar cliente' }));
  const fillCustomer = () => {
    type(/Nombre/, 'Mario Moto');
    type(/Celular/, '312 000 2222');
    fireEvent.click(screen.getByRole('checkbox', { name: /El cliente autorizó/ }));
  };
  const fillVehicle = () => {
    const part = within(vehiclePart());
    fireEvent.change(part.getByRole('combobox', { name: /Marca/ }), {
      target: { value: 'Suzuki' },
    });
    fireEvent.change(part.getByRole('combobox', { name: /Línea/ }), {
      target: { value: 'GSX-R600' },
    });
    fireEvent.change(plate(), { target: { value: 'uih 03d' } });
    fireEvent.click(part.getByRole('button', { name: /Color/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Negro' }));
  };

  it('keeps the vehicle out of sight until it is asked for, then shows its own fields (CA-05)', () => {
    setup();

    expect(withVehicle()).not.toBeChecked();
    expect(screen.queryByRole('group', { name: 'Primer vehículo' })).not.toBeInTheDocument();

    fireEvent.click(withVehicle());

    const part = within(vehiclePart());
    expect(part.getByRole('radio', { name: 'Motocicleta' })).toBeChecked();
    expect(part.getByRole('combobox', { name: /Marca/ })).toBeInTheDocument();
    expect(part.getByRole('combobox', { name: /Línea/ })).toBeInTheDocument();
    expect(plate()).toBeInTheDocument();
  });

  it('checks the vehicle before sending: incomplete, it shows its errors and sends nothing (CA-07)', async () => {
    setup();
    fillCustomer();
    fireEvent.click(withVehicle());

    submit();

    expect(await within(vehiclePart()).findByText('Escribe la marca.')).toBeVisible();
    expect(within(vehiclePart()).getByText('Escribe la placa.')).toBeVisible();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('sends the customer and their vehicle together, normalised, and hands the customer on (CA-07)', async () => {
    vi.mocked(createCustomer).mockResolvedValue({ ok: true, id: 'customer-new' });
    const { onSaved } = setup();
    fillCustomer();
    fireEvent.click(withVehicle());
    fillVehicle();

    submit();

    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'customer-new' }))
    );
    expect(createCustomer).toHaveBeenCalledWith({
      full_name: 'Mario Moto',
      email: null,
      phone: '3120002222',
      data_consent: true,
      vehicle: expect.objectContaining({
        vehicle_type: 'motorcycle',
        brand_name: 'Suzuki',
        line_name: 'GSX-R600',
        color: 'black',
        plate: 'UIH03D',
      }),
    });
  });

  it('shows a plate already taken under «Placa», where it can be fixed (CA-07)', async () => {
    vi.mocked(createCustomer).mockResolvedValue({
      ok: false,
      error: 'vehicle',
      vehicleError: 'plateTaken',
    });
    const { onSaved } = setup();
    fillCustomer();
    fireEvent.click(withVehicle());
    fillVehicle();

    submit();

    await waitFor(() =>
      expect(plate()).toHaveAccessibleDescription(
        expect.stringContaining('Ya hay un vehículo registrado con esta placa.')
      )
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it.each([
    ['a mobile', '300 123 4567', /Celular/, '300 123 4567'],
    ['a name', 'Marta Mostrador', /Nombre/, 'Marta Mostrador'],
  ])('puts %s searched in its field (CA-04)', (_, search, label, value) => {
    setup({ initialSearch: search });

    expect(screen.getByLabelText(label)).toHaveValue(value);
    expect(withVehicle()).not.toBeChecked();
  });

  it('puts a plate searched in the first vehicle, with its type, already asked for (CA-04)', () => {
    setup({ initialSearch: 'KDM482' });

    expect(withVehicle()).toBeChecked();
    expect(within(vehiclePart()).getByRole('radio', { name: 'Carro' })).toBeChecked();
    expect(plate()).toHaveValue('KDM-482');
  });
});
