/**
 * ServiceForm — an admin registers or corrects a service (spec 007, HU-01).
 *
 * Guards:
 * - CA-03: every problem is reported next to its field and nothing is sent.
 * - CA-01 / CA-05: registering and correcting send the typed values (the action normalises them
 *   again); the screen is told once it is saved.
 * - CA-04: a name taken by a disabled service suggests reactivating it.
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
  price_car: 40000,
  price_bicycle: null,
  disabled_at: null,
};

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
    fireEvent.click(screen.getByRole('button', { name: 'Registrar servicio' }));

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createService).toHaveBeenCalledWith({
      name: 'Micropulido',
      price_motorcycle: 120000,
      price_car: 250000,
      price_bicycle: null,
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
});
