/**
 * ServicesTable — the services with their reference price per vehicle type (spec 007, HU-01).
 *
 * Guards:
 * - CA-01: prices show in pesos («$ 25.000»), one column per vehicle type.
 * - CA-02: a type without a price shows «No disponible» (the service is not offered for it).
 * - CA-15: the row actions menu («Acciones de {nombre}») exists only when actions are given (an
 *   admin); an operator just reads.
 * - CA-12 / CA-13: an active service offers «Editar» and «Desactivar»; a disabled one shows the
 *   date it was disabled and offers «Reactivar».
 */
import { fireEvent, screen, within } from '@testing-library/react';

import type { ServiceRow } from '@web/modules/services/api/services.server';
import ServicesTable from '@web/modules/services/components/organisms/services-table.component';

import { renderWithProviders } from '@tests/test-utils/render';

const service = (overrides: Partial<ServiceRow> = {}): ServiceRow => ({
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Lavado sencillo',
  price_motorcycle: 25000,
  price_car: 40000,
  price_bicycle: null,
  disabled_at: null,
  ...overrides,
});

describe('ServicesTable', () => {
  it('shows each price in pesos, and «No disponible» where it is not offered (CA-01, CA-02)', () => {
    renderWithProviders(
      <ServicesTable services={[service()]} variant="active" label="Servicios" />
    );

    const row = screen.getByRole('row', { name: /Lavado sencillo/ });
    // One cell per vehicle type (from a tablet up).
    const cells = within(row)
      .getAllByRole('gridcell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual(['$ 25.000', '$ 40.000', 'No disponible']);
  });

  it('repeats the prices under the name, for phones, where the price columns are hidden (CA-01, CA-02)', () => {
    renderWithProviders(
      <ServicesTable services={[service()]} variant="active" label="Servicios" />
    );

    expect(screen.getByRole('rowheader', { name: /Lavado sencillo/ })).toHaveTextContent(
      'Lavado sencilloMoto: $ 25.000Carro: $ 40.000Bicicleta: No disponible'
    );
  });

  it('has no actions menu for someone who only reads (CA-15)', () => {
    renderWithProviders(
      <ServicesTable services={[service()]} variant="active" label="Servicios" />
    );

    expect(screen.queryByRole('button', { name: /^Acciones de/ })).not.toBeInTheDocument();
  });

  it('offers «Editar» and «Desactivar» on an active service, handing it over (CA-05, CA-12)', async () => {
    const onEdit = vi.fn();
    const onDisable = vi.fn();
    const lavado = service();
    renderWithProviders(
      <ServicesTable
        services={[lavado]}
        variant="active"
        label="Servicios"
        onEdit={onEdit}
        onDisable={onDisable}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Lavado sencillo' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar' }));
    expect(onDisable).toHaveBeenCalledWith(lavado);

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Lavado sencillo' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    expect(onEdit).toHaveBeenCalledWith(lavado);
  });

  it('shows when a disabled service was disabled, and offers «Reactivar» (CA-12, CA-13)', async () => {
    const onReactivate = vi.fn();
    const polichado = service({ name: 'Polichado', disabled_at: '2026-10-21T15:00:00Z' });
    renderWithProviders(
      <ServicesTable
        services={[polichado]}
        variant="disabled"
        label="Desactivados"
        onReactivate={onReactivate}
      />
    );

    expect(screen.getByRole('row', { name: /Polichado/ })).toHaveTextContent(
      '21 de octubre de 2026'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Polichado' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reactivar' }));
    expect(onReactivate).toHaveBeenCalledWith(polichado);
  });
});
