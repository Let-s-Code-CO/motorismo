import { fireEvent, screen, waitFor, within } from '@testing-library/react';

import { inviteUser } from '@web/modules/users/actions/users.actions';
import UsersSummary from '@web/modules/users/components/molecules/users-summary.component';
import InviteUserForm from '@web/modules/users/components/organisms/invite-user-form.component';
import UsersTable from '@web/modules/users/components/organisms/users-table.component';

import { buildProfile } from '@tests/test-utils/builders';
import { renderWithProviders } from '@tests/test-utils/render';

/**
 * User management UI (spec 002, HU-03).
 *
 * Guards:
 * - CA-17: the admin sees every user with name, email, role and status (Invitado, Activo,
 *   Desactivado).
 * - CA-16: only users still "invited" offer "Reenviar invitación".
 * - CA-18 / CA-19 / CA-20: the admin can change other users' role and disable or reactivate them.
 * - CA-10 / CA-21: the admin's own row offers no role or status change; when they are the only
 *   active admin, the row explains that at least one active admin must remain.
 * - CA-13: the invitation form shows an error next to each invalid field and sends nothing.
 * - CA-12: a duplicate email reported by the server is shown to the admin.
 * - Spec 003 CA-07: a summary by status, and each row's actions grouped in a menu.
 */

/** Opens the actions menu of a row (spec 003) and picks an option. */
const pick = async (userName: string, option: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Acciones de ${userName}` }));
  fireEvent.click(await screen.findByRole('menuitem', { name: option }));
};

vi.mock('@web/modules/users/actions/users.actions', () => ({ inviteUser: vi.fn() }));

describe('UsersTable', () => {
  const users = [
    buildProfile({
      id: 'u1',
      full_name: 'Ana Administradora',
      email: 'ana@m.test',
      role: 'admin',
      status: 'active',
    }),
    buildProfile({
      id: 'u2',
      full_name: 'Iván Invitado',
      email: 'ivan@m.test',
      role: 'operator',
      status: 'invited',
    }),
    buildProfile({
      id: 'u3',
      full_name: 'Diana Desactivada',
      email: 'diana@m.test',
      role: 'operator',
      status: 'disabled',
    }),
  ];

  const handlers = () => ({ onResend: vi.fn(), onChangeRole: vi.fn(), onChangeStatus: vi.fn() });

  it('lists every user with name, email, role and status in Spanish (CA-17)', () => {
    renderWithProviders(<UsersTable users={users} currentUserId="u1" {...handlers()} />);

    const row = (name: string) => within(screen.getByRole('row', { name: new RegExp(name) }));
    expect(row('Ana Administradora').getByText('ana@m.test')).toBeVisible();
    expect(row('Ana Administradora').getByText('Administrador')).toBeVisible();
    expect(row('Ana Administradora').getByText('Activo')).toBeVisible();
    expect(row('Iván Invitado').getByText('Operador')).toBeVisible();
    expect(row('Iván Invitado').getByText('Invitado')).toBeVisible();
    expect(row('Diana Desactivada').getByText('Desactivado')).toBeVisible();
  });

  it('offers "Reenviar invitación" only for invited users, passing their id (CA-16)', async () => {
    const props = handlers();
    renderWithProviders(<UsersTable users={users} currentUserId="u1" {...props} />);

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de Diana Desactivada' }));
    await screen.findByRole('menu');
    expect(screen.queryByRole('menuitem', { name: 'Reenviar invitación' })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    await pick('Iván Invitado', 'Reenviar invitación');
    expect(props.onResend).toHaveBeenCalledWith('u2');
  });

  it('lets the admin promote an invited operator (CA-18)', async () => {
    const props = handlers();
    renderWithProviders(<UsersTable users={users} currentUserId="u1" {...props} />);

    await pick('Iván Invitado', 'Hacer administrador');
    expect(props.onChangeRole).toHaveBeenCalledWith('u2', 'admin');
  });

  it('lets the admin disable another user (CA-19)', async () => {
    const props = handlers();
    renderWithProviders(<UsersTable users={users} currentUserId="u1" {...props} />);

    await pick('Iván Invitado', 'Desactivar');
    expect(props.onChangeStatus).toHaveBeenCalledWith('u2', 'disabled');
  });

  it('lets the admin reactivate a disabled user (CA-20)', async () => {
    const props = handlers();
    renderWithProviders(<UsersTable users={users} currentUserId="u1" {...props} />);

    await pick('Diana Desactivada', 'Reactivar');
    expect(props.onChangeStatus).toHaveBeenCalledWith('u3', 'active');
  });

  it("offers no role or status change on the admin's own row (CA-10)", () => {
    renderWithProviders(<UsersTable users={users} currentUserId="u1" {...handlers()} />);

    const own = within(screen.getByRole('row', { name: /Ana Administradora/ }));
    expect(own.queryByRole('button')).not.toBeInTheDocument();
    expect(own.getByText('Tu cuenta')).toBeVisible();
  });

  it('explains on their own row that the only active admin must remain (CA-21)', () => {
    renderWithProviders(<UsersTable users={users} currentUserId="u1" {...handlers()} />);

    expect(
      within(screen.getByRole('row', { name: /Ana Administradora/ })).getByText(
        'Debe existir al menos un administrador activo.'
      )
    ).toBeVisible();
  });

  it('does not show that warning when another active admin exists', () => {
    const twoAdmins = [
      ...users,
      buildProfile({ id: 'u4', full_name: 'Bea Admin', role: 'admin', status: 'active' }),
    ];
    renderWithProviders(<UsersTable users={twoAdmins} currentUserId="u1" {...handlers()} />);

    expect(
      screen.queryByText('Debe existir al menos un administrador activo.')
    ).not.toBeInTheDocument();
  });
});

describe('UsersSummary', () => {
  it('counts users by status (spec 003, CA-07)', () => {
    renderWithProviders(
      <UsersSummary
        users={[
          buildProfile({ status: 'active' }),
          buildProfile({ status: 'active' }),
          buildProfile({ status: 'invited' }),
          buildProfile({ status: 'disabled' }),
        ]}
      />
    );

    const count = (label: string) =>
      within(screen.getByText(label).closest('div')!).getByRole('definition').textContent;
    expect(count('Activos')).toBe('2');
    expect(count('Invitados')).toBe('1');
    expect(count('Desactivados')).toBe('1');
  });
});

describe('InviteUserForm', () => {
  afterEach(() => vi.clearAllMocks());

  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

  it('shows an error next to each missing field and sends nothing (CA-13)', async () => {
    renderWithProviders(<InviteUserForm onInvited={vi.fn()} />);

    submit();

    expect(await screen.findByText('Escribe el nombre.')).toBeVisible();
    expect(screen.getByText('Introduce un correo válido.')).toBeVisible();
    expect(screen.getByText('Elige un rol.')).toBeVisible();
    expect(inviteUser).not.toHaveBeenCalled();
  });

  const fillValid = () => {
    fireEvent.change(screen.getByLabelText(/Nombre/), { target: { value: 'Iván Invitado' } });
    fireEvent.change(screen.getByLabelText(/Correo/), { target: { value: 'ivan@m.test' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Operador' }));
  };

  it('shows the duplicate-email message returned by the server (CA-12)', async () => {
    vi.mocked(inviteUser).mockResolvedValue({ ok: false, error: 'emailTaken' });
    const onInvited = vi.fn();
    renderWithProviders(<InviteUserForm onInvited={onInvited} />);

    fillValid();
    submit();

    expect(await screen.findByText('Ya existe un usuario con este correo.')).toBeVisible();
    expect(onInvited).not.toHaveBeenCalled();
  });

  it('sends the invitation and notifies the screen on success (CA-11)', async () => {
    vi.mocked(inviteUser).mockResolvedValue({ ok: true });
    const onInvited = vi.fn();
    renderWithProviders(<InviteUserForm onInvited={onInvited} />);

    fillValid();
    submit();

    await waitFor(() => expect(onInvited).toHaveBeenCalledWith('ivan@m.test'));
    expect(inviteUser).toHaveBeenCalledWith({
      full_name: 'Iván Invitado',
      email: 'ivan@m.test',
      role: 'operator',
    });
  });
});
