/**
 * Authenticated chrome: header, user menu and the "no permission" page (specs 002 and 004).
 *
 * Guards:
 * - CA-01 / RF-05: the signed-in user always sees their name, their role and how to sign out.
 * - CA-07: an operator never sees options reserved to the admin (here: user management).
 * - CA-08: a page reserved to the admin shows "No tienes permiso…" with a way back home.
 * - Spec 004: a customer is labelled "Cliente" and only sees "Mi perfil" (CA-08); on a staff page
 *   they get "No tienes permiso…" with a link to their profile (CA-09).
 * - Spec 007, CA-19: staff also find «Servicios» and «Empleados»; a customer does not (CA-18).
 * - Spec 009, CA-01 / CA-02: on a phone everyone gets «Menú», which opens the side panel with the
 *   same links as the desktop menu, the current one marked (the panel itself: mobile-nav tests).
 */
import { fireEvent, screen, within } from '@testing-library/react';

import UserMenu from '@web/modules/auth/components/molecules/user-menu.component';
import AppHeader from '@web/modules/auth/components/organisms/app-header.component';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';

import { buildCustomer, buildProfile } from '@tests/test-utils/builders';
import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({ signOut: vi.fn() }));
// The page being shown: «Servicios».
vi.mock('next/navigation', () => ({
  usePathname: () => '/services',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('UserMenu', () => {
  it('shows the user name, their role in Spanish and a sign-out button (CA-01, RF-05)', () => {
    renderWithProviders(<UserMenu name="Ana Administradora" avatarUrl={null} audience="admin" />);

    expect(screen.getByText('Ana Administradora')).toBeVisible();
    expect(screen.getByText('Administrador')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  it('labels the operator role as "Operador"', () => {
    renderWithProviders(<UserMenu name="Óscar" avatarUrl={null} audience="operator" />);

    expect(screen.getByText('Operador')).toBeVisible();
  });

  it('labels a customer as "Cliente" (spec 004)', () => {
    renderWithProviders(<UserMenu name="Camila" avatarUrl={null} audience="customer" />);

    expect(screen.getByText('Cliente')).toBeVisible();
  });
});

describe('UserMenu avatar (CA-30)', () => {
  it('shows the Google photo when the user has one', () => {
    const { container } = renderWithProviders(
      <UserMenu
        name="Gina Google"
        avatarUrl="https://lh3.googleusercontent.com/a/gina"
        audience="customer"
      />
    );

    expect(
      container.querySelector('img[src="https://lh3.googleusercontent.com/a/gina"]')
    ).not.toBeNull();
  });

  it('shows the initials when there is no photo', () => {
    const { container } = renderWithProviders(
      <UserMenu name="Ana Administradora" avatarUrl={null} audience="admin" />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AA')).toBeInTheDocument();
  });
});

describe('AppHeader', () => {
  it('does not offer user management to an operator (CA-07)', () => {
    renderWithProviders(
      <AppHeader account={{ kind: 'staff', ...buildProfile({ role: 'operator' }) }} />
    );

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    // Spec 017: the admin's own sections are under «Administración», which an operator lacks.
    expect(screen.queryByRole('button', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('offers user management to an admin, under «Administración» (spec 017)', async () => {
    renderWithProviders(
      <AppHeader account={{ kind: 'staff', ...buildProfile({ role: 'admin' }) }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Administración' }));
    const menu = await screen.findByRole('menu', { name: 'Administración' });
    expect(within(menu).getByRole('menuitem', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it('shows a customer only "Mi perfil" and the "Cliente" label (spec 004, CA-08)', () => {
    renderWithProviders(<AppHeader account={{ kind: 'customer', ...buildCustomer() }} />);

    expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeVisible();
  });

  it('offers staff «Servicios» and «Empleados» (spec 007, CA-19)', () => {
    renderWithProviders(
      <AppHeader account={{ kind: 'staff', ...buildProfile({ role: 'operator' }) }} />
    );

    expect(screen.getByRole('link', { name: 'Servicios' })).toHaveAttribute('href', '/services');
    expect(screen.getByRole('link', { name: 'Empleados' })).toHaveAttribute('href', '/employees');
  });

  it('gives staff a «Menú» that opens the same links, the current one marked (spec 007, CA-19; spec 009, CA-02)', async () => {
    renderWithProviders(
      <AppHeader account={{ kind: 'staff', ...buildProfile({ role: 'admin' }) }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Menú' }));

    const panel = await screen.findByRole('dialog', { name: 'Menú principal' });
    expect(
      within(panel)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual([
      'Inicio',
      'Órdenes',
      'Agenda',
      'Clientes',
      'Servicios',
      'Empleados',
      'Reportes',
      'Habeas data',
      'Marcas y líneas', // spec 018, RF-04
      'Usuarios',
    ]);
    // The current section is marked (spec 003, CA-06).
    expect(within(panel).getByRole('link', { name: 'Servicios' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('never offers a customer the catalogs, not even in «Menú» (spec 007, CA-18; spec 009, CA-02)', async () => {
    renderWithProviders(<AppHeader account={{ kind: 'customer', ...buildCustomer() }} />);

    expect(screen.queryByRole('link', { name: 'Servicios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }));
    const panel = await screen.findByRole('dialog', { name: 'Menú principal' });
    expect(
      within(panel)
        .getAllByRole('link')
        .map((link) => link.textContent)
    ).toEqual(['Inicio', 'Mis reservas', 'Historial', 'Mi perfil']);
  });
});

describe('NoPermission', () => {
  it('explains the user has no permission and links back home (CA-08)', () => {
    renderWithProviders(<NoPermission audience="operator" />);

    expect(
      screen.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });

  it('sends a customer back to their own home (spec 004, CA-09; spec 014)', () => {
    renderWithProviders(<NoPermission audience="customer" />);

    expect(
      screen.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ir a mi inicio' })).toHaveAttribute('href', '/my');
  });
});
