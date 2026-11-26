/**
 * ServiceCards — the services as cards, with their reference values (spec 007, HU-01; spec 024).
 *
 * Guards:
 * - Spec 024, CA-09: the active services go in three groups, in this order, each a list named by its
 *   heading: «Paquetes por categoría» (from the cheapest up), «Valor único» and «A convenir»; an
 *   empty group is not drawn.
 * - CA-01 / CA-02: a service with a single value shows it in pesos for each vehicle type it is
 *   offered for, and names no type it is not offered for (amendment of spec 024: the card shows
 *   what can be charged, not what cannot).
 * - Spec 024, CA-09: a service by category shows its range («$ 42.000 a $ 52.000») and the value of
 *   each of the eight categories; CA-12: one «a convenir» says so, without any value.
 * - Spec 024, CA-19 / spec 008, CA-26: the description and the usual time on the card.
 * - CA-15: the actions menu («Acciones de {nombre}») exists only when actions are given (an admin).
 * - CA-12 / CA-13: an active service offers «Editar» and «Desactivar»; a disabled one shows the date
 *   it was disabled and offers «Reactivar»; the disabled ones are one list, without groups.
 * - CA-06: with no services, the empty text.
 */
import { fireEvent, screen, within } from '@testing-library/react';

import type { ServiceRow } from '@web/modules/services/api/services.server';
import ServiceCards from '@web/modules/services/components/organisms/service-cards.component';

import { renderWithProviders } from '@tests/test-utils/render';

const service = (overrides: Partial<ServiceRow> = {}): ServiceRow => ({
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Lavado sencillo',
  price_motorcycle: 25000,
  motorcycle_prices: null,
  on_quote: false,
  description: null,
  price_car: 40000,
  price_bicycle: null,
  estimated_minutes: null,
  disabled_at: null,
  ...overrides,
});

/** «Lavado Pro Wash» of the price list (spec 024, CA-17). */
const PRO_WASH_PRICES = {
  street: 44000,
  sbk: 46000,
  scooter: 42000,
  maxi_scooter: 46000,
  trail: 48000,
  maxi_trail: 52000,
  cruiser: 44000,
  maxi_cruiser: 48000,
};
const proWash = service({
  id: '20000000-0000-4000-8000-000000000002',
  name: 'Lavado Pro Wash',
  price_motorcycle: null,
  motorcycle_prices: PRO_WASH_PRICES,
  price_car: null,
});
const ppf = service({
  id: '20000000-0000-4000-8000-000000000003',
  name: 'PPF',
  price_motorcycle: null,
  price_car: null,
  on_quote: true,
});

const card = (name: string) => screen.getByRole('article', { name });

describe('ServiceCards', () => {
  it('groups the services: by category, single value and «a convenir», in that order (spec 024, CA-09)', () => {
    renderWithProviders(
      <ServiceCards services={[ppf, service(), proWash]} variant="active" label="Servicios" />
    );

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Paquetes por categoría',
      'Valor único',
      'A convenir',
    ]);
    expect(
      within(screen.getByRole('list', { name: 'Paquetes por categoría' })).getByRole('article')
    ).toHaveAccessibleName('Lavado Pro Wash');
    expect(
      within(screen.getByRole('list', { name: 'Valor único' })).getByRole('article')
    ).toHaveAccessibleName('Lavado sencillo');
    expect(
      within(screen.getByRole('list', { name: 'A convenir' })).getByRole('article')
    ).toHaveAccessibleName('PPF');
  });

  it('orders the packages from the cheapest up, as a price list (spec 024, CA-09)', () => {
    /** A package whose eight values are Pro Wash's plus `extra`. */
    const plus = (name: string, extra: number) => ({
      ...proWash,
      id: `s-${extra}`,
      name,
      motorcycle_prices: Object.fromEntries(
        Object.entries(PRO_WASH_PRICES).map(([category, value]) => [category, value + extra])
      ) as typeof PRO_WASH_PRICES,
    });
    renderWithProviders(
      <ServiceCards
        services={[
          plus('Combo de lavado Supreme', 658000),
          plus('Combo de lavado Deluxe', 128000),
          proWash,
          plus('Paquete de lavado Premium', 55000),
        ]}
        variant="active"
        label="Servicios"
      />
    );

    // Lowest values: 42.000, 97.000, 170.000 and 700.000.
    expect(
      within(screen.getByRole('list', { name: 'Paquetes por categoría' }))
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual([
      'Lavado Pro Wash',
      'Paquete de lavado Premium',
      'Combo de lavado Deluxe',
      'Combo de lavado Supreme',
    ]);
  });

  it('draws no group that has no service', () => {
    renderWithProviders(<ServiceCards services={[service()]} variant="active" label="Servicios" />);

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Valor único',
    ]);
  });

  it('shows a single value in pesos for each type it is offered for, and no type it is not (CA-01, CA-02)', () => {
    renderWithProviders(<ServiceCards services={[service()]} variant="active" label="Servicios" />);

    const values = within(card('Lavado sencillo')).getByRole('list', {
      name: 'Valores de Lavado sencillo',
    });
    expect(
      within(values)
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Moto$ 25.000', 'Carro$ 40.000']);
    expect(card('Lavado sencillo')).not.toHaveTextContent('Bicicleta');
  });

  it('shows the range of the values by category and each of the eight (spec 024, CA-09)', () => {
    renderWithProviders(<ServiceCards services={[proWash]} variant="active" label="Servicios" />);

    // From the Scooter's $ 42.000 to the Maxi Trail's $ 52.000.
    expect(card('Lavado Pro Wash')).toHaveTextContent('$ 42.000 a $ 52.000');
    const values = within(card('Lavado Pro Wash')).getByRole('list', {
      name: 'Valores por categoría de Lavado Pro Wash',
    });
    expect(within(values).getAllByRole('listitem')).toHaveLength(8);
    expect(within(values).getAllByRole('listitem')[5]).toHaveTextContent('Maxi Trail$ 52.000');
  });

  it('says «A convenir» for a service without values, and no value at all (spec 024, CA-12)', () => {
    renderWithProviders(<ServiceCards services={[ppf]} variant="active" label="Servicios" />);

    expect(card('PPF')).toHaveTextContent('Valor y tiempo se acuerdan en cada orden.');
    expect(card('PPF')).not.toHaveTextContent('$');
  });

  it('shows the description and the usual time (spec 024, CA-19; spec 008, CA-26)', () => {
    renderWithProviders(
      <ServiceCards
        services={[
          service({ description: 'Incluye sellador.', estimated_minutes: 150 }),
          service({ id: 's2', name: 'Cera', estimated_minutes: null }),
        ]}
        variant="active"
        label="Servicios"
      />
    );

    expect(card('Lavado sencillo')).toHaveTextContent('Incluye sellador.');
    expect(card('Lavado sencillo')).toHaveTextContent('≈ 2 h 30 min');
    expect(card('Cera')).not.toHaveTextContent('≈');
  });

  it('has no actions menu for someone who only reads (CA-15)', () => {
    renderWithProviders(<ServiceCards services={[service()]} variant="active" label="Servicios" />);

    expect(screen.queryByRole('button', { name: /^Acciones de/ })).not.toBeInTheDocument();
  });

  it('offers «Editar» and «Desactivar» on an active service, handing it over (CA-05, CA-12)', async () => {
    const onEdit = vi.fn();
    const onDisable = vi.fn();
    const lavado = service();
    renderWithProviders(
      <ServiceCards
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

  it('lists the disabled services without groups, with their date, and offers «Reactivar» (CA-12, CA-13)', async () => {
    const onReactivate = vi.fn();
    const polichado = service({ name: 'Polichado', disabled_at: '2026-10-21T15:00:00Z' });
    renderWithProviders(
      <ServiceCards
        services={[polichado, { ...proWash, disabled_at: '2026-10-22T15:00:00Z' }]}
        variant="disabled"
        label="Servicios desactivados"
        onReactivate={onReactivate}
      />
    );

    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Servicios desactivados' })).getAllByRole('article')
    ).toHaveLength(2);
    expect(card('Polichado')).toHaveTextContent('Desactivado el 21 de octubre de 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Polichado' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Reactivar' }));
    expect(onReactivate).toHaveBeenCalledWith(polichado);
  });

  it('says so when there is no service (CA-06)', () => {
    renderWithProviders(
      <ServiceCards services={[]} variant="active" label="Servicios" emptyLabel="Aún no hay." />
    );

    expect(screen.getByText('Aún no hay.')).toBeVisible();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
});
