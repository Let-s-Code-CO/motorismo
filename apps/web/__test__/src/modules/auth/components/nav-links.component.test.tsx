/**
 * NavLinks — main menu (spec 003, CA-06; spec 002, CA-07; spec 004, CA-08 and RF-04; spec 007,
 * CA-19).
 *
 * Guards: the section the user is in is marked as current (aria-current="page"); staff see Inicio,
 * Órdenes (spec 008), Agenda (spec 012), Clientes, Servicios and Empleados; a customer sees their own
 * Inicio, Mis reservas, Historial and Mi perfil (spec 014). Spec 017: the admin's own sections
 * (Reportes, Habeas data, Usuarios) go under «Administración» (nine in a row did not fit), which is
 * marked while one of them is open; choosing one goes there. An operator has no «Administración».
 */
import { usePathname } from 'next/navigation';

import { fireEvent, screen, within } from '@testing-library/react';

import NavLinks from '@web/modules/auth/components/molecules/nav-links.component';

import { renderWithProviders } from '@tests/test-utils/render';

const push = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: vi.fn(), useRouter: () => ({ push }) }));

const linkNames = () => screen.getAllByRole('link').map((link) => link.textContent);

/** Opens «Administración» and gives its items. */
const adminItems = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Administración' }));
  return within(await screen.findByRole('menu', { name: 'Administración' })).getAllByRole(
    'menuitem'
  );
};

describe('NavLinks', () => {
  afterEach(() => vi.clearAllMocks());

  it('marks the current section (CA-06)', () => {
    vi.mocked(usePathname).mockReturnValue('/orders');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(screen.getByRole('link', { name: 'Órdenes' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('marks «Administración» while one of its sections is open (spec 017)', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/users');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(screen.getByRole('button', { name: 'Administración' })).toHaveAttribute(
      'data-current',
      'true'
    );
  });

  it('marks Clientes on a customer record too (sub-pages belong to their section)', () => {
    vi.mocked(usePathname).mockReturnValue('/customers/abc');
    renderWithProviders(<NavLinks audience="operator" />);

    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows an admin Inicio, Órdenes, Agenda, Clientes, Servicios and Empleados, and under «Administración» Reportes, Habeas data and Usuarios (specs 007, 008, 012, 015 and 017)', async () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(linkNames()).toEqual([
      'Inicio',
      'Órdenes',
      'Agenda',
      'Clientes',
      'Servicios',
      'Empleados',
    ]);
    expect(screen.getByRole('button', { name: 'Administración' })).not.toHaveAttribute(
      'data-current'
    );
    expect((await adminItems()).map((item) => item.textContent)).toEqual([
      'Reportes',
      'Habeas data',
      'Usuarios',
    ]);
  });

  it('goes to the section chosen under «Administración» (spec 017)', async () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    fireEvent.click((await adminItems())[1]!);

    expect(push).toHaveBeenCalledWith('/admin/data-requests');
  });

  it('shows an operator the same sections, without «Administración» (CA-07, RF-04; spec 007, CA-19; spec 015, CA-09)', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="operator" />);

    expect(linkNames()).toEqual([
      'Inicio',
      'Órdenes',
      'Agenda',
      'Clientes',
      'Servicios',
      'Empleados',
    ]);
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('shows a customer «Inicio», «Mis reservas», «Historial» and «Mi perfil» (spec 004, CA-08; spec 014)', () => {
    vi.mocked(usePathname).mockReturnValue('/profile');
    renderWithProviders(<NavLinks audience="customer" />);

    expect(linkNames()).toEqual(['Inicio', 'Mis reservas', 'Historial', 'Mi perfil']);
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/my');
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page');
  });

  it('marks only «Historial» on the customer’s history: «Inicio» is not a prefix of their sections (spec 014)', () => {
    vi.mocked(usePathname).mockReturnValue('/my/history');
    renderWithProviders(<NavLinks audience="customer" />);

    expect(screen.getByRole('link', { name: 'Historial' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });
});
