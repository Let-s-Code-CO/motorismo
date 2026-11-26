/**
 * OrderEditor — the services of an order, who does them and what it adds up to (spec 008, HU-01).
 *
 * Guards:
 * - CA-03: only the active services with a price for the vehicle's type are offered, one tap each;
 *   a line takes that reference price, which can be changed.
 * - CA-04 / CA-25: subtotal, discount and total are always in sight, and change as soon as a line
 *   is added, removed or changed, before saving.
 * - CA-05: «Otro» takes a free description and price.
 * - CA-06 / RN-03: the employees of a line share it in equal parts, editable; with only one active
 *   employee, each new line already has them at 100 % (RN-10).
 * - CA-09: problems show next to their field and nothing is sent.
 * - Spec 024, CA-23 to CA-25, CA-27: «Añadir» is disabled for what cannot go with the services already
 *   added, saying why; a package's line says what it includes.
 * - CA-07: saving opens the order and hands its id over.
 * - CA-27 / CA-28: a line takes the service's time, which can be changed for this order only; a
 *   line without one is «Sin estimar» and can be filled in.
 * - CA-29 / CA-30: the estimate and the ready time are in sight; with lines not estimated it is a
 *   minimum («desde las …») and names them.
 * - CA-34 / RN-12: an order not started yet (a new one goes to the queue) shows only its duration.
 * - Spec 012, CA-12 / CA-13 / RN-07: a new order from a reservation starts with its services, as the
 *   catalog has them now, once; one not offered for the vehicle is named, not copied; saving sends
 *   the reservation. Linking it to an order already open adds nothing to its lines.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { setVehicleCategory } from '@web/modules/vehicles/actions/vehicles.actions';
import { saveWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import {
  fetchActiveEmployees,
  fetchActiveServices,
  fetchVehicleCategory,
} from '@web/modules/work-orders/api/work-orders.client';
import OrderEditor from '@web/modules/work-orders/components/organisms/order-editor.component';
import type {
  EmployeeOption,
  PickerCustomer,
  PickerVehicle,
  ServiceOption,
} from '@web/modules/work-orders/types/work-orders.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/work-orders/api/work-orders.client', () => ({
  fetchActiveServices: vi.fn(),
  fetchActiveEmployees: vi.fn(),
  fetchVehicleCategory: vi.fn(),
}));
vi.mock('@web/modules/vehicles/actions/vehicles.actions', () => ({ setVehicleCategory: vi.fn() }));
vi.mock('@web/modules/work-orders/actions/work-orders.actions', () => ({ saveWorkOrder: vi.fn() }));

const CUSTOMER: PickerCustomer = {
  id: '10000000-0000-4000-8000-000000000001',
  full_name: 'Camila Cliente',
  phone: null,
  email: null,
};
const MOTO: PickerVehicle = {
  id: '20000000-0000-4000-8000-000000000001',
  vehicle_type: 'motorcycle',
  plate: 'UIH03D',
  brand_name: 'Suzuki',
  line_name: 'GSX-R600',
  category: null,
  openOrder: null,
};

const service = (overrides: Partial<ServiceOption>): ServiceOption => ({
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Lavado sencillo',
  price_motorcycle: 25000,
  motorcycle_prices: null,
  price_car: 40000,
  price_bicycle: null,
  estimated_minutes: 30,
  on_quote: false,
  includes: [],
  ...overrides,
});
const SERVICES = [
  service({}),
  service({
    id: '30000000-0000-4000-8000-000000000002',
    name: 'Lavado detallado',
    price_motorcycle: 60000,
    estimated_minutes: 90,
  }),
  service({
    id: '30000000-0000-4000-8000-000000000003',
    name: 'Solo carros',
    price_motorcycle: null,
  }),
];
const ELKIN: EmployeeOption = {
  id: '40000000-0000-4000-8000-000000000001',
  full_name: 'Elkin Estrada',
};
const PAULA: EmployeeOption = {
  id: '40000000-0000-4000-8000-000000000002',
  full_name: 'Paula Pineda',
};

// Started at 2:00 p. m. in Bogotá (19:00 UTC).
const STARTED = new Date('2026-11-20T19:00:00Z');

const renderEditor = (
  employees: EmployeeOption[] = [ELKIN, PAULA],
  startedAt: Date | null = STARTED
) => {
  vi.mocked(fetchActiveServices).mockResolvedValue(SERVICES);
  vi.mocked(fetchActiveEmployees).mockResolvedValue(employees);
  vi.mocked(fetchVehicleCategory).mockResolvedValue('sbk');
  const onSaved = vi.fn();
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
  );
  renderWithProviders(
    wrap(
      <OrderEditor
        customer={CUSTOMER}
        vehicle={MOTO}
        startedAt={startedAt ?? undefined}
        onSaved={onSaved}
      />
    )
  );
  return { onSaved };
};

const addService = async (name: RegExp) =>
  fireEvent.click(await screen.findByRole('button', { name }));
const summary = () => screen.getByRole('region', { name: 'Resumen de la orden' });
const line = (name: string) => screen.getByRole('group', { name });
/** A share field, by its exact accessible name (what a screen reader announces). */
const share = (group: HTMLElement, name: string) =>
  within(group).getByRole('textbox', { name: `Participación de ${name}` });

describe('OrderEditor', () => {
  afterEach(() => vi.clearAllMocks());

  it('offers only the services with a price for the vehicle type, with that price (CA-03)', async () => {
    renderEditor();

    expect(await screen.findByRole('button', { name: /Añadir Lavado sencillo/ })).toHaveTextContent(
      '$ 25.000'
    );
    expect(screen.getByRole('button', { name: /Añadir Lavado detallado/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Solo carros/ })).not.toBeInTheDocument();
  });

  it('keeps subtotal, discount and total in sight as lines are added, changed and removed (CA-04, CA-25)', async () => {
    renderEditor();

    await addService(/Añadir Lavado sencillo/);
    await addService(/Añadir Lavado detallado/);
    expect(summary()).toHaveTextContent('Total$ 85.000');

    fireEvent.change(within(line('Lavado detallado')).getByLabelText('Valor'), {
      target: { value: '55.000' },
    });
    fireEvent.change(within(summary()).getByLabelText('Descuento'), { target: { value: '5000' } });
    // 25.000 + 55.000 = 80.000; minus 5.000 = 75.000.
    expect(summary()).toHaveTextContent('Subtotal$ 80.000');
    expect(summary()).toHaveTextContent('Total$ 75.000');

    fireEvent.click(
      within(line('Lavado sencillo')).getByRole('button', { name: 'Quitar Lavado sencillo' })
    );
    expect(summary()).toHaveTextContent('Total$ 50.000');
  });

  it('shares a line in equal parts among its employees, editable (CA-06)', async () => {
    renderEditor();
    await addService(/Añadir Lavado sencillo/);
    const lavado = line('Lavado sencillo');

    fireEvent.click(within(lavado).getByRole('button', { name: 'Elkin Estrada' }));
    fireEvent.click(within(lavado).getByRole('button', { name: 'Paula Pineda' }));

    expect(share(lavado, 'Elkin Estrada')).toHaveValue('50');
    expect(share(lavado, 'Paula Pineda')).toHaveValue('50');
    fireEvent.change(share(lavado, 'Elkin Estrada'), {
      target: { value: '80' },
    });
    fireEvent.change(share(lavado, 'Paula Pineda'), {
      target: { value: '20' },
    });
    expect(share(lavado, 'Elkin Estrada')).toHaveValue('80');
  });

  it('assigns the only active employee to each new line, at 100 % (RN-10)', async () => {
    renderEditor([ELKIN]);

    await addService(/Añadir Lavado sencillo/);

    expect(
      within(line('Lavado sencillo')).getByRole('button', { name: 'Elkin Estrada' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds «Otro» with a free description and price, and reports what is missing (CA-05, CA-09)', async () => {
    renderEditor();
    await addService(/Añadir Otro/);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir orden' }));

    expect(await screen.findByText('Describe el servicio.')).toBeVisible();
    expect(saveWorkOrder).not.toHaveBeenCalled();
  });

  it('opens the order and hands its id over (CA-07)', async () => {
    vi.mocked(saveWorkOrder).mockResolvedValue({ ok: true, id: 'order-9' });
    const { onSaved } = renderEditor([ELKIN]);
    await addService(/Añadir Lavado sencillo/);

    fireEvent.click(screen.getByRole('button', { name: 'Abrir orden' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith('order-9'));
    expect(saveWorkOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        id: null,
        customer_id: CUSTOMER.id,
        vehicle_id: MOTO.id,
        lines: [
          expect.objectContaining({
            service_id: SERVICES[0]!.id,
            price: 25000,
            employees: [{ employee_id: ELKIN.id, share_pct: 100 }],
          }),
        ],
      })
    );
  });

  it("copies the service's time to the line, editable for this order only (CA-27)", async () => {
    renderEditor();

    await addService(/Añadir Lavado detallado/);
    const minutes = within(line('Lavado detallado')).getByLabelText('Tiempo (min)');

    expect(minutes).toHaveValue('90');
    fireEvent.change(minutes, { target: { value: '120' } });
    expect(minutes).toHaveValue('120');
  });

  it('shows the estimate and the ready time when every line has a time (CA-29)', async () => {
    renderEditor();

    await addService(/Añadir Lavado sencillo/);
    await addService(/Añadir Lavado detallado/);

    // 30 + 90 = 120 minutes after 2:00 p. m.
    expect(summary()).toHaveTextContent('≈ 2 h · lista hacia las 4:00 p. m.');
  });

  it('shows only a minimum, naming what is not estimated, with «Otro» (CA-28, CA-30)', async () => {
    renderEditor();

    await addService(/Añadir Lavado sencillo/);
    await addService(/Añadir Otro/);
    fireEvent.change(within(line('Otro')).getByLabelText('Descripción'), {
      target: { value: 'Limpieza de cadena' },
    });

    expect(within(line('Limpieza de cadena')).getByLabelText('Tiempo (min)')).toHaveAttribute(
      'placeholder',
      'Sin estimar'
    );
    expect(summary()).toHaveTextContent('≈ 30 min · desde las 2:30 p. m.');
    expect(summary()).toHaveTextContent('Falta estimar: Limpieza de cadena');
  });

  it('says «Sin tiempo estimado» when no line has a time (CA-30)', async () => {
    renderEditor();

    await addService(/Añadir Otro/);

    expect(summary()).toHaveTextContent('Sin tiempo estimado');
  });

  it('shows only the duration for an order not started yet, as a new one (CA-34, RN-12)', async () => {
    renderEditor([ELKIN, PAULA], null);

    await addService(/Añadir Lavado detallado/);

    expect(summary()).toHaveTextContent('≈ 1 h 30 min');
    expect(summary()).not.toHaveTextContent('lista hacia');
  });
});

describe('OrderEditor from a reservation (spec 012)', () => {
  afterEach(() => vi.clearAllMocks());

  const RESERVATION = {
    id: '50000000-0000-4000-8000-000000000001',
    service_ids: [SERVICES[1]!.id, SERVICES[2]!.id],
    services: ['Lavado detallado', 'Solo carros'],
    service_minutes: [null, null],
    // 9:00 a. m. in Bogotá.
    slot_start: '2030-06-12T14:00:00Z',
  };

  const renderFromReservation = (order?: Parameters<typeof OrderEditor>[0]['order']) => {
    vi.mocked(fetchActiveServices).mockResolvedValue(SERVICES);
    vi.mocked(fetchActiveEmployees).mockResolvedValue([ELKIN]);
    renderWithProviders(
      <QueryClientProvider client={new QueryClient()}>
        <OrderEditor
          customer={CUSTOMER}
          vehicle={MOTO}
          order={order}
          reservation={RESERVATION}
          onSaved={vi.fn()}
        />
      </QueryClientProvider>
    );
  };

  it('starts with the services offered for the vehicle, names the others, and sends the reservation (CA-12, CA-13, RN-07)', async () => {
    vi.mocked(saveWorkOrder).mockResolvedValue({ ok: true, id: 'order-1' });
    renderFromReservation();

    expect(await screen.findByRole('group', { name: 'Lavado detallado' })).toBeVisible();
    // «Solo carros» has no price for a motorcycle: it is named, not copied.
    expect(screen.queryByRole('group', { name: 'Solo carros' })).not.toBeInTheDocument();
    expect(screen.getByText('Llegó con la reserva de las 9:00 a. m.')).toBeVisible();
    expect(
      screen.getByText(
        'No se copiaron de la reserva (ya no se ofrecen para este vehículo): Solo carros.'
      )
    ).toBeVisible();
    // RN-10: the only active employee is on the line.
    expect(within(line('Lavado detallado')).getByText('Elkin Estrada')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir orden' }));

    await vi.waitFor(() =>
      expect(saveWorkOrder).toHaveBeenCalledWith(
        expect.objectContaining({ id: null, reservation_id: RESERVATION.id })
      )
    );
    expect(vi.mocked(saveWorkOrder).mock.calls[0]![0]).toMatchObject({
      // Only «Lavado detallado», at its current catalog price for a motorcycle (60.000).
      lines: [expect.objectContaining({ service_id: SERVICES[1]!.id, price: 60000 })],
    });
  });
});

describe('OrderEditor — categories and services «a convenir» (spec 024)', () => {
  afterEach(() => vi.clearAllMocks());

  const PRO_WASH = service({
    id: '30000000-0000-4000-8000-000000000010',
    name: 'Lavado Pro Wash',
    price_motorcycle: null,
    motorcycle_prices: {
      street: 44000,
      sbk: 46000,
      scooter: 42000,
      maxi_scooter: 46000,
      trail: 48000,
      maxi_trail: 52000,
      cruiser: 44000,
      maxi_cruiser: 48000,
    },
    price_car: null,
  });
  const PPF = service({
    id: '30000000-0000-4000-8000-000000000011',
    name: 'PPF',
    price_motorcycle: null,
    price_car: null,
    estimated_minutes: null,
    on_quote: true,
  });

  const render = (category: string | null) => {
    vi.mocked(fetchActiveServices).mockResolvedValue([PRO_WASH, PPF]);
    vi.mocked(fetchActiveEmployees).mockResolvedValue([ELKIN]);
    vi.mocked(fetchVehicleCategory).mockResolvedValue(category as never);
    renderWithProviders(
      <QueryClientProvider client={new QueryClient()}>
        <OrderEditor customer={CUSTOMER} vehicle={MOTO} onSaved={vi.fn()} />
      </QueryClientProvider>
    );
  };

  it('shows the motorcycle’s category and offers the value of it (CA-04, CA-10)', async () => {
    render('sbk');

    expect(await screen.findByText('Categoría de la moto: SBK/SSP')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Añadir Lavado Pro Wash/ })).toHaveTextContent(
      '$ 46.000'
    );
    await addService(/Añadir Lavado Pro Wash/);
    expect(within(line('Lavado Pro Wash')).getByRole('textbox', { name: /Valor/ })).toHaveValue(
      '46.000'
    );
  });

  it('asks a motorcycle without category for it first, keeps it, then adds the line with its value (CA-06)', async () => {
    vi.mocked(setVehicleCategory).mockResolvedValue({ ok: true });
    render(null);

    expect(await screen.findByText('Categoría de la moto: Sin categoría')).toBeInTheDocument();
    await addService(/Añadir Lavado Pro Wash/);
    const dialog = await screen.findByRole('dialog', { name: 'Categoría de la moto' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Categoría/ }));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Trail' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(setVehicleCategory).toHaveBeenCalledWith({ vehicle_id: MOTO.id, category: 'trail' })
    );
    expect(
      await within(await screen.findByRole('group', { name: 'Lavado Pro Wash' })).findByRole(
        'textbox',
        {
          name: /Valor/,
        }
      )
    ).toHaveValue('48.000');
  });

  it('adds a service «a convenir» without value, and does not save it so (CA-13, RN-02)', async () => {
    render('sbk');

    expect(await screen.findByRole('button', { name: /Añadir PPF/ })).toHaveTextContent(
      'A convenir'
    );
    await addService(/Añadir PPF/);
    expect(within(line('PPF')).getByRole('textbox', { name: /Valor/ })).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir orden' }));

    expect(await within(line('PPF')).findByText(/valor/i)).toBeInTheDocument();
    expect(saveWorkOrder).not.toHaveBeenCalled();
  });

  describe('from a reservation', () => {
    const SEATS = service({
      id: '30000000-0000-4000-8000-000000000012',
      name: 'Limpieza de asientos',
      price_motorcycle: 16000,
      price_car: null,
    });

    const renderFrom = (
      reservation: {
        service_ids: string[];
        services: string[];
        service_minutes: (number | null)[];
      },
      category: string | null
    ) => {
      vi.mocked(fetchActiveServices).mockResolvedValue([PRO_WASH, PPF, SEATS]);
      vi.mocked(fetchActiveEmployees).mockResolvedValue([ELKIN]);
      vi.mocked(fetchVehicleCategory).mockResolvedValue(category as never);
      renderWithProviders(
        <QueryClientProvider client={new QueryClient()}>
          <OrderEditor
            customer={CUSTOMER}
            vehicle={MOTO}
            reservation={{
              id: '50000000-0000-4000-8000-000000000002',
              slot_start: '2030-06-12T14:00:00Z',
              ...reservation,
            }}
            onSaved={vi.fn()}
          />
        </QueryClientProvider>
      );
    };

    it('brings a service «a convenir» with the time given in the reservation and no value (CA-15)', async () => {
      renderFrom({ service_ids: [PPF.id], services: ['PPF'], service_minutes: [240] }, 'sbk');

      const ppf = await screen.findByRole('group', { name: 'PPF' });
      expect(within(ppf).getByRole('textbox', { name: /Valor/ })).toHaveValue('');
      expect(within(ppf).getByRole('textbox', { name: /Tiempo/ })).toHaveValue('240');
    });

    it('asks once for the category of a motorcycle without one, then adds the package with its value and the extra (CA-06)', async () => {
      vi.mocked(setVehicleCategory).mockResolvedValue({ ok: true });
      renderFrom(
        {
          service_ids: [PRO_WASH.id, SEATS.id],
          services: ['Lavado Pro Wash', 'Limpieza de asientos'],
          service_minutes: [null, null],
        },
        null
      );

      const dialog = await screen.findByRole('dialog', { name: 'Categoría de la moto' });
      fireEvent.click(within(dialog).getByRole('button', { name: /Categoría/ }));
      fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Trail' }));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      const value = async (name: string) =>
        within(await screen.findByRole('group', { name })).getByRole('textbox', { name: /Valor/ });
      expect(await value('Lavado Pro Wash')).toHaveValue('48.000');
      expect(await value('Limpieza de asientos')).toHaveValue('16.000');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('OrderEditor — packages and what they include (spec 024, HU-05)', () => {
  afterEach(() => vi.clearAllMocks());

  const BY_CATEGORY = {
    street: 90000,
    sbk: 90000,
    scooter: 90000,
    maxi_scooter: 90000,
    trail: 90000,
    maxi_trail: 90000,
    cruiser: 90000,
    maxi_cruiser: 90000,
  };
  const SELLADOR = service({
    id: '30000000-0000-4000-8000-000000000021',
    name: 'Sellador',
    price_car: null,
  });
  const PREMIUM = service({
    id: '30000000-0000-4000-8000-000000000020',
    name: 'Premium',
    price_motorcycle: null,
    motorcycle_prices: BY_CATEGORY,
    price_car: null,
    includes: [SELLADOR.id],
  });
  const DELUXE = service({
    id: '30000000-0000-4000-8000-000000000022',
    name: 'Deluxe',
    price_motorcycle: null,
    motorcycle_prices: BY_CATEGORY,
    price_car: null,
  });

  const render = () => {
    vi.mocked(fetchActiveServices).mockResolvedValue([PREMIUM, DELUXE, SELLADOR]);
    vi.mocked(fetchActiveEmployees).mockResolvedValue([ELKIN]);
    vi.mocked(fetchVehicleCategory).mockResolvedValue('sbk');
    renderWithProviders(
      <QueryClientProvider client={new QueryClient()}>
        <OrderEditor customer={CUSTOMER} vehicle={MOTO} onSaved={vi.fn()} />
      </QueryClientProvider>
    );
  };

  it('disables adding what a package includes and another package, saying why (CA-23, CA-24)', async () => {
    render();

    await addService(/Añadir Premium/);

    const sellador = screen.getByRole('button', { name: /Añadir Sellador/ });
    expect(sellador).toBeDisabled();
    expect(sellador).toHaveAccessibleName(expect.stringContaining('Incluido en Premium'));
    expect(screen.getByRole('button', { name: /Añadir Deluxe/ })).toHaveAccessibleName(
      expect.stringContaining('Ya hay un paquete: Premium')
    );
  });

  it('allows them again once the package line is removed', async () => {
    render();

    await addService(/Añadir Premium/);
    fireEvent.click(within(line('Premium')).getByRole('button', { name: /Quitar/ }));

    expect(screen.getByRole('button', { name: /Añadir Sellador/ })).toBeEnabled();
  });

  it('says on the package line what it includes (CA-27)', async () => {
    render();

    await addService(/Añadir Premium/);

    expect(line('Premium')).toHaveTextContent('Incluye: Sellador');
  });

  it('groups what can be added: «Paquetes» apart from «Servicios adicionales», «Otro» with them (CA-28)', async () => {
    render();

    const packages = await screen.findByRole('group', { name: 'Paquetes' });
    expect(
      within(packages)
        .getAllByRole('button')
        .map((button) => button.textContent)
    ).toEqual([expect.stringContaining('Premium'), expect.stringContaining('Deluxe')]);
    const extras = within(screen.getByRole('group', { name: 'Servicios adicionales' }));
    expect(extras.getByRole('button', { name: /Añadir Sellador/ })).toBeVisible();
    expect(extras.getByRole('button', { name: /Añadir Otro/ })).toBeVisible();
  });

  it('turns the button of an added service into «Quitar», which removes its line: never added twice (CA-29)', async () => {
    render();

    await addService(/Añadir Premium/);
    expect(screen.queryByRole('button', { name: /Añadir Premium/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Premium de la orden' }));

    expect(screen.queryByRole('group', { name: 'Premium' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Añadir Premium/ })).toBeEnabled();
  });

  it('adds «Otro» as many times as needed (CA-29)', async () => {
    render();

    await addService(/Añadir Otro/);
    await addService(/Añadir Otro/);

    expect(screen.getAllByRole('group', { name: 'Otro' })).toHaveLength(2);
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
      service({
        id,
        name,
        price_motorcycle: null,
        motorcycle_prices: ladder(lowest),
        price_car: null,
      });
    // As the catalog comes: by name.
    vi.mocked(fetchActiveServices).mockResolvedValue([
      pkg('30000000-0000-4000-8000-000000000031', 'Combo de lavado Deluxe', 170000),
      pkg('30000000-0000-4000-8000-000000000032', 'Combo de lavado Supreme', 700000),
      pkg('30000000-0000-4000-8000-000000000033', 'Lavado Pro Wash', 42000),
      pkg('30000000-0000-4000-8000-000000000034', 'Paquete de lavado Premium', 97000),
    ]);
    vi.mocked(fetchActiveEmployees).mockResolvedValue([ELKIN]);
    vi.mocked(fetchVehicleCategory).mockResolvedValue('sbk');
    renderWithProviders(
      <QueryClientProvider client={new QueryClient()}>
        <OrderEditor customer={CUSTOMER} vehicle={MOTO} onSaved={vi.fn()} />
      </QueryClientProvider>
    );

    const packages = await screen.findByRole('group', { name: 'Paquetes' });
    expect(
      within(packages)
        .getAllByRole('button')
        .map((button) => button.textContent?.replace(/^Añadir |\$.*$/g, '').trim())
    ).toEqual([
      'Lavado Pro Wash',
      'Paquete de lavado Premium',
      'Combo de lavado Deluxe',
      'Combo de lavado Supreme',
    ]);
  });
});
