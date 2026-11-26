/**
 * PlateCitiesScreen — «Ciudades de placa», a tab of «Marcas y líneas» (spec 023, HU-03).
 *
 * Guards:
 * - RN-04: only the municipalities that issue plates are listed, Bogotá, D.C. first, each with a
 *   sample plate drawn with its legend.
 * - CA-09: one without its own legend says it uses its name (in capitals, without accents).
 * - CA-10: «Cambiar leyenda» opens the dialog for that city; the search ignores case and accents.
 */
import { fireEvent, screen, within } from '@testing-library/react';

import PlateCitiesScreen from '@web/modules/vehicles/components/organisms/plate-cities-screen.component';
import type { PlateCity } from '@web/modules/vehicles/types/vehicles.types';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@web/modules/vehicles/actions/plate-cities.actions', () => ({ setPlateLegend: vi.fn() }));

const city = (overrides: Partial<PlateCity> = {}): PlateCity => ({
  code: '05001',
  name: 'Medellín',
  department: 'Antioquia',
  plate_legend: null,
  ...overrides,
});

const cities = [
  city(),
  city({
    code: '11001',
    name: 'Bogotá, D.C.',
    department: 'Bogotá, D.C.',
    plate_legend: 'STFE DE BOGOTA',
  }),
  city({ code: '76001', name: 'Cali', department: 'Valle del Cauca' }),
];

describe('PlateCitiesScreen', () => {
  it('lists the cities that issue plates, Bogotá, D.C. first, each with its sample plate (RN-04, CA-09)', () => {
    renderWithProviders(<PlateCitiesScreen cities={cities} />);

    const items = within(screen.getByRole('list', { name: 'Ciudades de placa' })).getAllByRole(
      'listitem'
    );
    expect(items.map((item) => item.querySelector('h2')?.textContent)).toEqual([
      'Bogotá, D.C.',
      'Cali',
      'Medellín',
    ]);
    expect(items[0]).toHaveTextContent('Leyenda propia');
    const legend = (item: HTMLElement) =>
      item.querySelector<HTMLElement>('[data-plate]')?.dataset.legend;
    expect(legend(items[0]!)).toBe('STFE DE BOGOTA');
    expect(items[2]).toHaveTextContent('Usa su nombre');
    expect(legend(items[2]!)).toBe('MEDELLIN');
  });

  it('finds a city ignoring case and accents', () => {
    renderWithProviders(<PlateCitiesScreen cities={cities} />);

    fireEvent.change(screen.getByLabelText('Buscar ciudad'), { target: { value: 'medellin' } });

    expect(
      within(screen.getByRole('list', { name: 'Ciudades de placa' })).getAllByRole('listitem')
    ).toHaveLength(1);
  });

  it('opens the dialog of a city to change its legend (CA-10)', async () => {
    renderWithProviders(<PlateCitiesScreen cities={cities} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar leyenda de Cali' }));

    expect(await screen.findByRole('dialog', { name: 'Leyenda de Cali' })).toBeInTheDocument();
  });

  it('marks itself as the «Ciudades de placa» tab of «Marcas y líneas»', () => {
    renderWithProviders(<PlateCitiesScreen cities={cities} />);

    expect(screen.getByRole('link', { name: 'Ciudades de placa' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Marcas y líneas' })).toHaveAttribute(
      'href',
      '/admin/vehicle-catalog'
    );
  });
});
