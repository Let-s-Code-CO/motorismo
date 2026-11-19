// @vitest-environment node
/**
 * users.actions — inviteUser / resendInvite, the admin's way to give someone access (spec 002).
 *
 * Guards:
 * - CA-09: only an ACTIVE ADMIN may invite; anyone else is rejected before Auth is touched.
 * - CA-12: an email that already belongs to a user is rejected with its own message. This check
 *   is ours on purpose: Auth silently RE-SENDS the invitation to an unconfirmed email instead of
 *   failing (see __test__/sandbox/invite.sandbox.test.ts). Spec 004 (RN-01): the check covers the
 *   whole app (staff, pending invitations, customers and unconfirmed sign-ups).
 * - CA-13: invalid input returns one error per field and nothing is sent.
 * - CA-11 / spec 004 RN-11: a valid invitation is first written as a pending staff invitation
 *   with the admin's OWN session (RLS: only admins, signed as themselves); the database builds the
 *   profile from it, never from metadata. If Auth then fails, the pending invitation is withdrawn.
 * - CA-16: resending only applies to users still in "invited".
 * - CA-18 / CA-19 / CA-20 / CA-21: role and status changes go through the admin's OWN session, so
 *   RLS and the database guard decide; the guard's refusals (last admin, own account) become their
 *   own messages. Disabling also bans the account in Auth (no new session can be issued) and
 *   reactivating lifts the ban; if Auth fails, the profile change is reverted.
 * - CA-29 / RN-08: reactivating someone who never accepted their invitation returns them to
 *   "invited" (so the invitation can be re-sent), never to "active".
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  changeRole,
  inviteUser,
  resendInvite,
  setUserStatus,
} from '@web/modules/users/actions/users.actions';

import { buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({ getActiveAdmin: vi.fn() }));
vi.mock('@web/modules/core/lib/supabase-admin.lib', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('@web/modules/core/utils/site-url.utils', () => ({ getSiteUrl: () => 'https://app.test' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const ADMIN = buildProfile({ id: 'admin-id', role: 'admin', full_name: 'Ana Administradora' });

type FakeOptions = {
  row?: Record<string, unknown> | null;
  lookupError?: { message: string } | null;
  inUse?: boolean;
  inUseError?: { message: string } | null;
  inviteError?: { code?: string; message: string } | null;
};

/**
 * Minimal stand-in for the secret-key client: from().select().eq().maybeSingle() (resendInvite),
 * rpc('email_in_use') and auth.admin.inviteUserByEmail.
 */
const fakeAdminClient = ({
  row = null,
  lookupError = null,
  inUse = false,
  inUseError = null,
  inviteError = null,
}: FakeOptions = {}) => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: lookupError });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const rpc = vi.fn().mockResolvedValue({ data: inUse, error: inUseError });
  const inviteUserByEmail = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: 'new-id' } }, error: inviteError });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    from,
    rpc,
    auth: { admin: { inviteUserByEmail } },
  } as never);
  return { from, eq, rpc, inviteUserByEmail };
};

/** The admin's own session: the pending invitation is written under RLS (spec 004). */
const fakeInvitationSession = (insertError: { code?: string; message: string } | null = null) => {
  const insert = vi.fn().mockResolvedValue({ error: insertError });
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn(() => ({ eq: deleteEq }));
  const from = vi.fn(() => ({ insert, delete: remove }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from } as never);
  return { from, insert, deleteEq };
};

const validInput = {
  full_name: ' Óscar Operador ',
  email: 'Oscar@Motorismo.test',
  role: 'operator',
};

describe('inviteUser', () => {
  beforeEach(() => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
  });

  afterEach(() => vi.clearAllMocks());

  it('rejects anyone who is not an active admin, without touching Auth (CA-09)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    await expect(inviteUser(validInput)).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it('returns one error per invalid field and sends nothing (CA-13)', async () => {
    const { inviteUserByEmail } = fakeAdminClient();

    await expect(inviteUser({ full_name: '', email: 'x', role: '' })).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
      fieldErrors: {
        full_name: ['fullNameRequired'],
        email: ['emailInvalid'],
        role: ['roleRequired'],
      },
    });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('rejects an email already used anywhere in the app, checked in lowercase (CA-12; spec 004, RN-01)', async () => {
    // email_in_use covers accounts (also unconfirmed customer sign-ups), staff, pending
    // invitations and customers without account.
    const { rpc, inviteUserByEmail } = fakeAdminClient({ inUse: true });
    const { insert } = fakeInvitationSession();

    await expect(inviteUser(validInput)).resolves.toEqual({ ok: false, error: 'emailTaken' });
    expect(rpc).toHaveBeenCalledWith('email_in_use', { p_email: 'oscar@motorismo.test' });
    expect(insert).not.toHaveBeenCalled();
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('writes the pending invitation with the admin as inviter, then invites with a link back to this site (CA-11)', async () => {
    const { inviteUserByEmail } = fakeAdminClient();
    const { from, insert } = fakeInvitationSession();

    await expect(inviteUser(validInput)).resolves.toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith('staff_invitations');
    expect(insert).toHaveBeenCalledWith({
      email: 'oscar@motorismo.test',
      full_name: 'Óscar Operador',
      role: 'operator',
      invited_by: 'admin-id',
    });
    // No metadata: the database builds the profile from the invitation only (spec 004, RN-11).
    expect(inviteUserByEmail).toHaveBeenCalledWith('oscar@motorismo.test', {
      redirectTo: 'https://app.test',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
  });

  it('does not invite when the database refuses the pending invitation', async () => {
    const { inviteUserByEmail } = fakeAdminClient();
    fakeInvitationSession({ code: '42501', message: 'rls' });

    await expect(inviteUser(validInput)).resolves.toEqual({ ok: false, error: 'generic' });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('withdraws the pending invitation when Auth fails, and maps email_exists to its message (CA-12)', async () => {
    fakeAdminClient({ inviteError: { code: 'email_exists', message: 'exists' } });
    const { deleteEq } = fakeInvitationSession();

    await expect(inviteUser(validInput)).resolves.toEqual({ ok: false, error: 'emailTaken' });
    expect(deleteEq).toHaveBeenCalledWith('email', 'oscar@motorismo.test');
  });

  it('returns a generic error when Auth fails for another reason, without revalidating', async () => {
    fakeAdminClient({ inviteError: { code: 'unexpected_failure', message: 'boom' } });
    const { deleteEq } = fakeInvitationSession();

    await expect(inviteUser(validInput)).resolves.toEqual({ ok: false, error: 'generic' });
    expect(deleteEq).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a generic error when the duplicate check fails', async () => {
    const { inviteUserByEmail } = fakeAdminClient({ inUseError: { message: 'db down' } });
    fakeInvitationSession();

    await expect(inviteUser(validInput)).resolves.toEqual({ ok: false, error: 'generic' });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });
});

describe('resendInvite', () => {
  beforeEach(() => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
  });

  afterEach(() => vi.clearAllMocks());

  it('rejects anyone who is not an active admin (CA-09)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    await expect(resendInvite('user-id')).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it.each(['active', 'disabled'])(
    'refuses to resend to a user who is already %s',
    async (status) => {
      const { inviteUserByEmail } = fakeAdminClient({ row: { email: 'a@motorismo.test', status } });

      await expect(resendInvite('user-id')).resolves.toEqual({ ok: false, error: 'notInvited' });
      expect(inviteUserByEmail).not.toHaveBeenCalled();
    }
  );

  it('re-sends the invitation to an invited user; Auth issues a new link (CA-16)', async () => {
    const { eq, inviteUserByEmail } = fakeAdminClient({
      row: { email: 'a@motorismo.test', status: 'invited' },
    });

    await expect(resendInvite('user-id')).resolves.toEqual({ ok: true });
    expect(eq).toHaveBeenCalledWith('id', 'user-id');
    expect(inviteUserByEmail).toHaveBeenCalledWith('a@motorismo.test', {
      redirectTo: 'https://app.test',
    });
  });
});

const USER_ID = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

type UpdateOutcome = {
  data?: unknown;
  error?: { code?: string; hint?: string; message: string } | null;
};

/** The admin's session client: profiles read (previous status) and update (RLS + guard). */
const fakeSessionClient = ({
  current = { status: 'active' },
  updates = [{ data: { id: USER_ID }, error: null }],
}: { current?: Record<string, unknown> | null; updates?: UpdateOutcome[] } = {}) => {
  const update = vi.fn();
  updates.forEach((outcome) =>
    update.mockReturnValueOnce({
      eq: () => ({
        select: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: null, ...outcome }),
        }),
      }),
    })
  );
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: current, error: null }) }),
    }),
    update,
  }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from } as never);
  return { update };
};

const fakeAuthAdmin = (banError: { message: string } | null = null) => {
  const updateUserById = vi.fn().mockResolvedValue({ data: {}, error: banError });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    auth: { admin: { updateUserById } },
  } as never);
  return { updateUserById };
};

describe('changeRole', () => {
  beforeEach(() => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
  });

  afterEach(() => vi.clearAllMocks());

  it('rejects anyone who is not an active admin (CA-09)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    await expect(changeRole({ userId: USER_ID, role: 'admin' })).resolves.toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it('updates the role with the admin session and refreshes the list (CA-18)', async () => {
    const { update } = fakeSessionClient();

    await expect(changeRole({ userId: USER_ID, role: 'admin' })).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ role: 'admin' });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/users');
  });

  it('explains that one active admin must remain when the database refuses (CA-21)', async () => {
    fakeSessionClient({
      updates: [{ error: { code: '23514', hint: 'profile_last_admin', message: 'at least one' } }],
    });

    await expect(changeRole({ userId: USER_ID, role: 'operator' })).resolves.toEqual({
      ok: false,
      error: 'lastAdmin',
    });
  });

  it('explains that nobody changes their own role (CA-10)', async () => {
    fakeSessionClient({
      updates: [{ error: { code: '42501', hint: 'profile_self_change', message: 'own' } }],
    });

    await expect(changeRole({ userId: USER_ID, role: 'operator' })).resolves.toEqual({
      ok: false,
      error: 'selfChange',
    });
  });

  it('rejects an invalid role or user id without touching the database', async () => {
    await expect(changeRole({ userId: 'not-a-uuid', role: 'boss' })).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });
});

describe('setUserStatus', () => {
  beforeEach(() => {
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
  });

  afterEach(() => vi.clearAllMocks());

  it('rejects anyone who is not an active admin (CA-09)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);

    await expect(setUserStatus({ userId: USER_ID, status: 'disabled' })).resolves.toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('disables the profile and bans the account in Auth (CA-19)', async () => {
    const { update } = fakeSessionClient({ current: { status: 'active' } });
    const { updateUserById } = fakeAuthAdmin();

    await expect(setUserStatus({ userId: USER_ID, status: 'disabled' })).resolves.toEqual({
      ok: true,
    });
    expect(update).toHaveBeenCalledWith({ status: 'disabled' });
    // 876000 h = 100 years: effectively permanent until an admin reactivates.
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, { ban_duration: '876000h' });
  });

  it('reactivates a user who had accepted their invitation and lifts the ban (CA-20)', async () => {
    const { update } = fakeSessionClient({
      current: { status: 'disabled', activated_at: '2026-11-01T10:00:00Z' },
    });
    const { updateUserById } = fakeAuthAdmin();

    await expect(setUserStatus({ userId: USER_ID, status: 'active' })).resolves.toEqual({
      ok: true,
    });
    expect(update).toHaveBeenCalledWith({ status: 'active' });
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, { ban_duration: 'none' });
  });

  it('returns a user who never accepted to "invited" instead of "active" (CA-29)', async () => {
    const { update } = fakeSessionClient({ current: { status: 'disabled', activated_at: null } });
    const { updateUserById } = fakeAuthAdmin();

    await expect(setUserStatus({ userId: USER_ID, status: 'active' })).resolves.toEqual({
      ok: true,
    });
    expect(update).toHaveBeenCalledWith({ status: 'invited' });
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, { ban_duration: 'none' });
  });

  it('reverts the profile to its previous status when Auth fails to ban', async () => {
    const { update } = fakeSessionClient({
      current: { status: 'invited' },
      updates: [{ data: { id: USER_ID } }, { data: { id: USER_ID } }],
    });
    fakeAuthAdmin({ message: 'auth down' });

    await expect(setUserStatus({ userId: USER_ID, status: 'disabled' })).resolves.toEqual({
      ok: false,
      error: 'generic',
    });
    expect(update).toHaveBeenNthCalledWith(1, { status: 'disabled' });
    expect(update).toHaveBeenNthCalledWith(2, { status: 'invited' });
  });

  it('does not ban when the database refuses the change (CA-21)', async () => {
    fakeSessionClient({
      updates: [{ error: { code: '23514', hint: 'profile_last_admin', message: 'at least one' } }],
    });
    const { updateUserById } = fakeAuthAdmin();

    await expect(setUserStatus({ userId: USER_ID, status: 'disabled' })).resolves.toEqual({
      ok: false,
      error: 'lastAdmin',
    });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('only accepts active or disabled as the new status (never back to invited)', async () => {
    await expect(setUserStatus({ userId: USER_ID, status: 'invited' })).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
    });
  });
});
