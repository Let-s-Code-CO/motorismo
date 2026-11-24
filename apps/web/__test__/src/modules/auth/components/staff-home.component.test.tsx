/**
 * StaffHome — the staff's home page as an app menu (spec 009, HU-02): one tile per section the role
 * may open, and what is in the car wash at a glance on «Órdenes».
 *
 * Guards:
 * - CA-06 / RN-01: one tile per section of the role («Reportes» and «Usuarios» only for an admin, spec 015); the whole tile
 *   is the link, icon included. (Two columns and the hidden description on a phone are layout:
 *   e2e/ui.spec.ts.)
 * - CA-07: «Órdenes» says how many orders are in progress and how many queued, or «Sin órdenes
 *   abiertas».
 * - CA-09: each tile keeps its description for the desktop.
 */
import { screen, within } from '@testing-library/react';

import StaffHome from '@web/modules/auth/components/organisms/staff-home.component';
import type { UserRole } from '@web/modules/auth/types/auth.types';

import { renderWithProviders } from '@tests/test-utils/render';

const renderHome = ({
  role = 'admin' as UserRole,
  openOrders = { inProgress: 2, queued: 1 },
} = {}) =>
  renderWithProviders(<StaffHome name="Carlos Díaz" role={role} openOrders={openOrders} />);

const tiles = () => within(screen.getByRole('list', { name: 'Secciones' })).getAllByRole('link');

describe('StaffHome', () => {
  it('greets the person with their role', () => {
    renderHome();

    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Carlos Díaz' })).toBeVisible();
    expect(screen.getByText(/Tu rol: Administrador/)).toBeVisible();
  });

  it('gives an admin a tile for every section, each a link with its icon (CA-06)', () => {
    renderHome();

    expect(tiles().map((tile) => tile.getAttribute('href'))).toEqual([
      '/orders',
      '/agenda',
      '/customers',
      '/services',
      '/employees',
      '/reports',
      '/admin/users',
    ]);
    for (const tile of tiles()) {
      expect(tile.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('gives an operator the same tiles without «Reportes» or «Usuarios» (CA-06, RN-01; spec 015, CA-09)', () => {
    renderHome({ role: 'operator' });

    expect(tiles().map((tile) => tile.getAttribute('href'))).toEqual([
      '/orders',
      '/agenda',
      '/customers',
      '/services',
      '/employees',
    ]);
  });

  it('says on «Órdenes» how many are in progress and queued (CA-07)', () => {
    renderHome({ openOrders: { inProgress: 2, queued: 1 } });

    const orders = screen.getByRole('link', { name: /Órdenes/ });
    const stat = (label: string) =>
      within(orders).getByText(label).closest('[data-stat]')?.textContent;
    expect(stat('En proceso')).toBe('2En proceso');
    expect(stat('En cola')).toBe('1En cola');
  });

  it('says «Sin órdenes abiertas» when nothing is open (CA-07)', () => {
    renderHome({ openOrders: { inProgress: 0, queued: 0 } });

    expect(screen.getByRole('link', { name: /Órdenes/ })).toHaveTextContent('Sin órdenes abiertas');
  });

  it('keeps the description of each section for the desktop (CA-09)', () => {
    renderHome();

    expect(screen.getByRole('link', { name: /Clientes/ })).toHaveTextContent(
      'Consulta, busca y registra a los clientes del negocio.'
    );
  });

  it('says «Reportes» holds the services and the payroll, and «Muy pronto» what comes next (spec 016)', () => {
    renderHome();

    expect(screen.getByRole('link', { name: /Reportes/ })).toHaveTextContent(
      'Los servicios hechos y la liquidación de los empleados, para exportar a Excel.'
    );
    expect(screen.getByText('Administrar marcas y líneas de vehículos.')).toBeInTheDocument();
  });
});
