/**
 * NavLinks — main menu (spec 003, CA-06; spec 002, CA-07; spec 004, CA-08 and RF-04; spec 007,
 * CA-19).
 *
 * Guards: the section the user is in is marked as current (aria-current="page"); staff see Inicio,
 * Órdenes (spec 008), Clientes, Servicios and Empleados, and only admins also see Usuarios; a customer
 * sees their own Inicio, Mis reservas, Historial and Mi perfil (spec 014).
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

  it('shows Inicio, Órdenes, Agenda, Clientes, Servicios, Empleados, Reportes, Habeas data and Usuarios to an admin (specs 007, 008, 012, 015 and 017)', () => {
    vi.mocked(usePathname).mockReturnValue('/');
    renderWithProviders(<NavLinks audience="admin" />);

    expect(linkNames()).toEqual([
      'Inicio',
      'Órdenes',
      'Agenda',
      'Clientes',
      'Servicios',
      'Empleados',
      'Reportes',
      'Habeas data',
      'Usuarios',
    ]);
  });

  it('shows an operator the same sections without Reportes or Usuarios (CA-07, RF-04; spec 007, CA-19; spec 015, CA-09)', () => {
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
