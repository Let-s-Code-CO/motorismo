/**
 * UsersScreen — the user management screen (spec 003, CA-07).
 *
 * Guards CA-07: the admin sees HOW MANY users are active, invited and disabled. The numbers on the
 * summary cards are counted here from the list (the cards component only draws what it is given),
 * so they must match the users of each status.
 *
 * Spec 013: what an action did is said in a floating notice (CA-01); a refusal too, and it stays
 * until closed (CA-07).
 */
import { fireEvent, screen } from '@testing-library/react';

import { setUserStatus } from '@web/modules/users/actions/users.actions';
import UsersScreen from '@web/modules/users/components/organisms/users-screen.component';

import { buildProfile } from '@tests/test-utils/builders';
import { inToasts, renderWithProviders } from '@tests/test-utils/render';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/admin/users',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@web/modules/users/actions/users.actions', () => ({
  inviteUser: vi.fn(),
  resendInvite: vi.fn(),
  changeRole: vi.fn(),
  setUserStatus: vi.fn(),
}));

describe('UsersScreen', () => {
  it('counts the users of each status on the summary cards: 2 active, 1 invited, 1 disabled (CA-07)', () => {
    const admin = buildProfile({ role: 'admin', status: 'active' });
    renderWithProviders(
      <UsersScreen
        currentUserId={admin.id}
        users={[
          admin,
          buildProfile({ status: 'active' }),
          buildProfile({ status: 'invited' }),
          buildProfile({ status: 'disabled' }),
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /^Activos 2$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Invitados 1$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Desactivados 1$/ })).toBeInTheDocument();
  });

  const disableIvan = async () => {
    const admin = buildProfile({ id: 'u1', role: 'admin', status: 'active' });
    renderWithProviders(
      <UsersScreen
        currentUserId={admin.id}
        users={[admin, buildProfile({ id: 'u2', full_name: 'Iván Invitado', status: 'active' })]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Iván Invitado' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Desactivar' }));
  };

  it('says the user was disabled in a floating notice (spec 013, CA-01)', async () => {
    vi.mocked(setUserStatus).mockResolvedValue({ ok: true });

    await disableIvan();

    expect(
      await inToasts().findByText(
        'Usuario desactivado. Su sesión se cerrará en su siguiente acción.'
      )
    ).toBeVisible();
  });

  it('says a refusal as an error that stays (spec 013, CA-07)', async () => {
    vi.mocked(setUserStatus).mockResolvedValue({ ok: false, error: 'generic' });

    await disableIvan();

    const error = await inToasts().findByText('Algo salió mal. Inténtalo de nuevo.');
    expect(error.closest('[data-toast]')).toHaveAttribute('data-toast', 'danger');
  });
});
