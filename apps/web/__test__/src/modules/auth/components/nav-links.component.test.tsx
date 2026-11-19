/**
 * NavLinks — main menu (spec 003, CA-06; spec 002, CA-07; spec 004, CA-08 and RF-04).
 *
 * Guards: the section the user is in is marked as current (aria-current="page"); staff see Inicio
 * and Clientes and only admins also see Usuarios; a customer only sees "Mi perfil".
 */
import { usePathname } from 'next/navigation';

import { screen } from '@testing-library/react';

import NavLinks from '@web/modules/auth/components/molecules/nav-links.component';

import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));

const linkNames = () => screen.getAllByRole('link').map((link) => link.textContent);

describe('NavLinks', () => {
  it('marks the current section (CA-06)', () => {
    vi.mocked(usePathname).mockReturnValue('/admin/users');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');
  });

  it('marks Clientes on a customer record too (sub-pages belong to their section)', () => {
    vi.mocked(usePathname).mockReturnValue('/customers/abc');
    renderWithProviders(<NavLinks audience="operator" />);

    expect(screen.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows Inicio, Clientes and Usuarios to an admin', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(linkNames()).toEqual(['Inicio', 'Clientes', 'Usuarios']);
  });

  it('shows Inicio and Clientes to an operator, without Usuarios (CA-07, RF-04)', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="operator" />);

    expect(linkNames()).toEqual(['Inicio', 'Clientes']);
  });

  it('shows only "Mi perfil" to a customer (spec 004, CA-08)', () => {
    vi.mocked(usePathname).mockReturnValue('/profile');
    renderWithProviders(<NavLinks audience="customer" />);

    expect(linkNames()).toEqual(['Mi perfil']);
    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('aria-current', 'page');
  });
});
