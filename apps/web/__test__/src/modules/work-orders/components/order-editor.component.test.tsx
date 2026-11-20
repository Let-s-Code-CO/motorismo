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
 * - CA-07: saving opens the order and hands its id over.
 * - CA-27 / CA-28: a line takes the service's time, which can be changed for this order only; a
 *   line without one is «Sin estimar» and can be filled in.
 * - CA-29 / CA-30: the estimate and the ready time are in sight; with lines not estimated it is a
 *   minimum («desde las …») and names them.
 */
import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { fireEvent, screen, within } from '@testing-library/react';

import { saveWorkOrder } from '@web/modules/work-orders/actions/work-orders.actions';
import {
  fetchActiveEmployees,
  fetchActiveServices,
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
}));
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
  openOrder: null,
};

const service = (overrides: Partial<ServiceOption>): ServiceOption => ({
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Lavado sencillo',
  price_motorcycle: 25000,
  price_car: 40000,
  price_bicycle: null,
  estimated_minutes: 30,
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

// Received at 2:00 p. m. in Bogotá (19:00 UTC).
const RECEIVED = new Date('2026-11-20T19:00:00Z');

const renderEditor = (employees: EmployeeOption[] = [ELKIN, PAULA]) => {
  vi.mocked(fetchActiveServices).mockResolvedValue(SERVICES);
  vi.mocked(fetchActiveEmployees).mockResolvedValue(employees);
  const onSaved = vi.fn();
  const wrap = (node: ReactNode) => (
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>
  );
  renderWithProviders(
    wrap(<OrderEditor customer={CUSTOMER} vehicle={MOTO} receivedAt={RECEIVED} onSaved={onSaved} />)
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
});
