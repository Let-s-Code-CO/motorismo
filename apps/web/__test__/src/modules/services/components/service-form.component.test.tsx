/**
 * ServiceForm — an admin registers or corrects a service (spec 007, HU-01).
 *
 * Guards:
 * - CA-03: every problem is reported next to its field and nothing is sent.
 * - CA-01 / CA-05: registering and correcting send the typed values (the action normalises them
 *   again); the screen is told once it is saved.
 * - CA-04: a name taken by a disabled service suggests reactivating it.
 * - Spec 024, CA-07 / CA-08: the motorcycle value is «Único» or «Por categoría»: eight fields, each
 *   labelled by its category, each missing one reported next to it; a service with values by category
 *   opens with them.
 * - Spec 024, CA-12: «A convenir» hides values and time, and sends none.
 * - Spec 024, CA-19: an optional description.
 */
import { fireEvent, screen } from '@testing-library/react';

import { createService, updateService } from '@web/modules/services/actions/services.actions';
import type { ServiceRow } from '@web/modules/services/api/services.server';
import ServiceForm from '@web/modules/services/components/organisms/service-form.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/services/actions/services.actions', () => ({
  createService: vi.fn(),
  updateService: vi.fn(),
}));

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const lavado: ServiceRow = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Lavado sencillo',
  price_motorcycle: 25000,
  motorcycle_prices: null,
  price_car: 40000,
  price_bicycle: null,
  estimated_minutes: 30,
  on_quote: false,
  description: null,
  disabled_at: null,
};

/** The categories in the order of the list, with the Pro Wash values. */
const PRO_WASH: [string, string, number][] = [
  ['Street/Roadster', '44.000', 44000],
  ['SBK/SSP', '46.000', 46000],
  ['Scooter', '42.000', 42000],
  ['Maxi Scooter', '46.000', 46000],
  ['Trail', '48.000', 48000],
  ['Maxi Trail', '52.000', 52000],
  ['Cruiser/Clásica', '44.000', 44000],
  ['Maxi Cruiser', '48.000', 48000],
];
const KEYS = [
  'street',
  'sbk',
  'scooter',
  'maxi_scooter',
  'trail',
  'maxi_trail',
  'cruiser',
  'maxi_cruiser',
] as const;
const proWashPrices = Object.fromEntries(
  KEYS.map((key, index) => [key, PRO_WASH[index]![2]])
) as Record<(typeof KEYS)[number], number>;
const NEW_FIELDS = { motorcycle_prices: null, on_quote: false, description: null };

describe('ServiceForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('reports a missing name and a missing price, and sends nothing (CA-03)', async () => {
    renderWithProviders(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    expect(await screen.findByText('Escribe el nombre del servicio.')).toBeVisible();
    expect(screen.getByText('Indica el valor de al menos un tipo de vehículo.')).toBeVisible();
    expect(createService).not.toHaveBeenCalled();
  });

  it('reports a price that is not whole pesos, next to it (CA-03)', async () => {
    renderWithProviders(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    type('Nombre del servicio', 'Micropulido');
    type('Moto', '12,5');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    expect(
      await screen.findByText('Escribe un valor en pesos, sin decimales, entre $ 1 y $ 10.000.000.')
    ).toBeVisible();
    expect(createService).not.toHaveBeenCalled();
  });

  it('registers a service with its prices and tells the screen (CA-01)', async () => {
    vi.mocked(createService).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    renderWithProviders(<ServiceForm onSaved={onSaved} onCancel={vi.fn()} />);

    type('Nombre del servicio', 'Micropulido');
    type('Moto', '120.000');
    type('Carro', '250000');
    // Spec 008, CA-26: how long it usually takes.
    type('Tiempo estimado (min)', '120');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createService).toHaveBeenCalledWith({
      name: 'Micropulido',
      price_motorcycle: 120000,
      price_car: 250000,
      price_bicycle: null,
      estimated_minutes: 120,
      ...NEW_FIELDS,
    });
  });

  it('opens with the current values and saves the correction (CA-05)', async () => {
    vi.mocked(updateService).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    renderWithProviders(<ServiceForm service={lavado} onSaved={onSaved} onCancel={vi.fn()} />);

    expect(screen.getByLabelText('Moto')).toHaveValue('25.000');
    expect(screen.getByLabelText('Bicicleta')).toHaveValue('');
    type('Bicicleta', '15.000');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateService).toHaveBeenCalledWith({
      id: lavado.id,
      name: 'Lavado sencillo',
      price_motorcycle: 25000,
      price_car: 40000,
      price_bicycle: 15000,
      estimated_minutes: 30,
      ...NEW_FIELDS,
    });
  });

  it('suggests reactivating when the name belongs to a disabled service (CA-04)', async () => {
    vi.mocked(createService).mockResolvedValue({ ok: false, error: 'nameTakenDisabled' });
    renderWithProviders(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

    type('Nombre del servicio', 'Polichado');
    type('Carro', '150.000');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    expect(
      await screen.findByText(
        'Ya existe un servicio desactivado con ese nombre: reactívalo desde «Desactivados».'
      )
    ).toBeVisible();
  });

  describe('spec 024', () => {
    it('registers a value for each category, with its description (CA-07, CA-19)', async () => {
      vi.mocked(createService).mockResolvedValue({ ok: true });
      const onSaved = vi.fn();
      renderWithProviders(<ServiceForm onSaved={onSaved} onCancel={vi.fn()} />);

      type('Nombre del servicio', 'Lavado Pro Wash');
      type('Descripción', 'Shampoo alcalino y de pH neutro.');
      fireEvent.click(screen.getByRole('radio', { name: 'Por categoría' }));
      expect(screen.queryByLabelText('Moto')).not.toBeInTheDocument();
      for (const [label, typed] of PRO_WASH) type(label, typed);
      fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

      await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
      expect(createService).toHaveBeenCalledWith({
        name: 'Lavado Pro Wash',
        price_motorcycle: null,
        motorcycle_prices: proWashPrices,
        price_car: null,
        price_bicycle: null,
        estimated_minutes: null,
        on_quote: false,
        description: 'Shampoo alcalino y de pH neutro.',
      });
    });

    it('reports each category without a value next to it, and sends nothing (CA-08)', async () => {
      renderWithProviders(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

      type('Nombre del servicio', 'Lavado Pro Wash');
      fireEvent.click(screen.getByRole('radio', { name: 'Por categoría' }));
      for (const [label, typed] of PRO_WASH.slice(0, 6)) type(label, typed);
      fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

      expect(await screen.findAllByText('Escribe el valor de esta categoría.')).toHaveLength(2);
      expect(createService).not.toHaveBeenCalled();
    });

    it('opens a service with values by category on them (CA-07)', () => {
      renderWithProviders(
        <ServiceForm
          service={{ ...lavado, price_motorcycle: null, motorcycle_prices: proWashPrices }}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      expect(screen.getByRole('radio', { name: 'Por categoría' })).toBeChecked();
      expect(screen.getByLabelText('Maxi Trail')).toHaveValue('52.000');
    });

    it('registers a service «a convenir» without values nor time (CA-12)', async () => {
      vi.mocked(createService).mockResolvedValue({ ok: true });
      renderWithProviders(<ServiceForm onSaved={vi.fn()} onCancel={vi.fn()} />);

      type('Nombre del servicio', 'PPF');
      fireEvent.click(screen.getByRole('switch', { name: /A convenir/ }));
      expect(screen.queryByLabelText('Carro')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Tiempo estimado (min)')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

      await vi.waitFor(() =>
        expect(createService).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'PPF',
            on_quote: true,
            price_car: null,
            estimated_minutes: null,
          })
        )
      );
    });
  });
});
