/**
 * Authenticated chrome: header, user menu and the "no permission" page (specs 002 and 004).
 *
 * Guards:
 * - CA-01 / RF-05: the signed-in user always sees their name, their role and how to sign out.
 * - CA-07: an operator never sees options reserved to the admin (here: user management).
 * - CA-08: a page reserved to the admin shows "No tienes permiso…" with a way back home.
 * - Spec 004: a customer is labelled "Cliente" and only sees "Mi perfil" (CA-08); on a staff page
 *   they get "No tienes permiso…" with a link to their profile (CA-09).
 * - Spec 007, CA-19: staff also find «Servicios» and «Empleados»; a customer does not (CA-18). With
 *   that many options the menu no longer fits a phone: below the desktop width staff get a «Menú»
 *   button with the same links, the current one marked.
 */
import { fireEvent, screen } from '@testing-library/react';

import UserMenu from '@web/modules/auth/components/molecules/user-menu.component';
import AppHeader from '@web/modules/auth/components/organisms/app-header.component';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';

import { buildCustomer, buildProfile } from '@tests/test-utils/builders';
import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({ signOut: vi.fn() }));
// The page being shown: «Servicios».
vi.mock('next/navigation', () => ({ usePathname: () => '/services' }));

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
  });

  it('offers user management to an admin', () => {
    renderWithProviders(
      <AppHeader account={{ kind: 'staff', ...buildProfile({ role: 'admin' }) }} />
    );

    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/admin/users');
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

  it('gives staff a «Menú» button with the same links, for narrow screens (spec 007, CA-19)', async () => {
    renderWithProviders(
      <AppHeader account={{ kind: 'staff', ...buildProfile({ role: 'admin' }) }} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Menú' }));

    const items = await screen.findAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'Inicio',
      'Órdenes',
      'Clientes',
      'Servicios',
      'Empleados',
      'Usuarios',
    ]);
    // The current section is marked (spec 003, CA-06).
    expect(screen.getByRole('menuitemradio', { name: 'Servicios' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('menuitemradio', { name: 'Inicio' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('never offers a customer the catalogs, nor the «Menú» button (spec 007, CA-18)', () => {
    renderWithProviders(<AppHeader account={{ kind: 'customer', ...buildCustomer() }} />);

    expect(screen.queryByRole('link', { name: 'Servicios' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Empleados' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Menú' })).not.toBeInTheDocument();
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

  it('sends a customer back to their profile (spec 004, CA-09)', () => {
    renderWithProviders(<NoPermission audience="customer" />);

    expect(
      screen.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ir a mi perfil' })).toHaveAttribute(
      'href',
      '/profile'
    );
  });
});
