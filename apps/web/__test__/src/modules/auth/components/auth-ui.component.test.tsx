/**
 * Authenticated chrome: header, user menu and the "no permission" page (spec 002).
 *
 * Guards:
 * - CA-01 / RF-05: the signed-in user always sees their name, their role and how to sign out.
 * - CA-07: an operator never sees options reserved to the admin (here: user management).
 * - CA-08: a page reserved to the admin shows "No tienes permiso…" with a way back home.
 */
import { screen } from '@testing-library/react';

import UserMenu from '@web/modules/auth/components/molecules/user-menu.component';
import AppHeader from '@web/modules/auth/components/organisms/app-header.component';
import NoPermission from '@web/modules/auth/components/organisms/no-permission.component';

import { buildProfile } from '@tests/test-utils/builders';
import { renderWithProviders } from '@tests/test-utils/render';

vi.mock('@web/modules/auth/actions/auth.actions', () => ({ signOut: vi.fn() }));

describe('UserMenu', () => {
  it('shows the user name, their role in Spanish and a sign-out button (CA-01, RF-05)', () => {
    renderWithProviders(
      <UserMenu user={buildProfile({ full_name: 'Ana Administradora', role: 'admin' })} />
    );

    expect(screen.getByText('Ana Administradora')).toBeVisible();
    expect(screen.getByText('Administrador')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  });

  it('labels the operator role as "Operador"', () => {
    renderWithProviders(<UserMenu user={buildProfile({ role: 'operator' })} />);

    expect(screen.getByText('Operador')).toBeVisible();
  });
});

describe('UserMenu avatar (CA-30)', () => {
  it('shows the Google photo when the user has one', () => {
    const { container } = renderWithProviders(
      <UserMenu
        user={buildProfile({
          full_name: 'Gina Google',
          avatar_url: 'https://lh3.googleusercontent.com/a/gina',
        })}
      />
    );

    expect(
      container.querySelector('img[src="https://lh3.googleusercontent.com/a/gina"]')
    ).not.toBeNull();
  });

  it('shows the initials when there is no photo', () => {
    const { container } = renderWithProviders(
      <UserMenu user={buildProfile({ full_name: 'Ana Administradora', avatar_url: null })} />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('AA')).toBeInTheDocument();
  });
});

describe('AppHeader', () => {
  it('does not offer user management to an operator (CA-07)', () => {
    renderWithProviders(<AppHeader user={buildProfile({ role: 'operator' })} />);

    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('offers user management to an admin', () => {
    renderWithProviders(<AppHeader user={buildProfile({ role: 'admin' })} />);

    expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/admin/users');
  });
});

describe('NoPermission', () => {
  it('explains the user has no permission and links back home (CA-08)', () => {
    renderWithProviders(<NoPermission />);

    expect(
      screen.getByRole('heading', { name: 'No tienes permiso para ver esta página.' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
  });
});
