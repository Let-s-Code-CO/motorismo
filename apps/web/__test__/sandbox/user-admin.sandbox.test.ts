/**
 * Account management primitives against the real local Auth + database (spec 002, HU-04/HU-05).
 *
 * The Server Actions (changeRole / setUserStatus) combine two steps verified here:
 * the admin's own session updates public.profiles (RLS + guard), and the secret key bans or
 * un-bans the account in Auth so that no new session can be issued.
 * Guards:
 * - CA-18: a role change applies to the user's very next query.
 * - CA-06 / CA-19: a disabled + banned account cannot sign in (user_banned).
 * - CA-20: reactivating lets the user sign in again with their usual password.
 * - CA-25: a disabled user who requests a recovery link still cannot get a session.
 */
import {
  SEED,
  adminClient,
  confirmLinkOf,
  createActiveUser,
  deleteUsersByEmail,
  publicClient,
  signedInAs,
  uniqueEmail,
  waitForEmail,
} from './support/sandbox';

const BAN_FOREVER = '876000h';
const created: string[] = [];

const newUser = async (label: string) => {
  const email = uniqueEmail(label);
  created.push(email);
  const id = await createActiveUser({ email, fullName: `Prueba ${label}` });
  return { email, id };
};

afterAll(() => deleteUsersByEmail(created));

describe('changing the role (CA-18)', () => {
  it('applies to the user on their next query', async () => {
    const user = await newUser('role');
    const { client } = await signedInAs(user.email);
    expect((await client.rpc('is_admin')).data).toBe(false);

    const { client: admin } = await signedInAs(SEED.admin);
    const { data } = await admin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user.id)
      .select('role');
    expect(data).toEqual([{ role: 'admin' }]);

    // Same session, no new sign-in: the next query already sees admin permissions.
    expect((await client.rpc('is_admin')).data).toBe(true);
  });
});

describe('disabling and reactivating (CA-06, CA-19, CA-20)', () => {
  it('a disabled and banned account cannot sign in; once reactivated it can, with the same password', async () => {
    const user = await newUser('disable');
    const { client: admin } = await signedInAs(SEED.admin);

    await admin.from('profiles').update({ status: 'disabled' }).eq('id', user.id);
    await adminClient().auth.admin.updateUserById(user.id, { ban_duration: BAN_FOREVER });

    const blocked = await publicClient().auth.signInWithPassword({
      email: user.email,
      password: SEED.password,
    });
    expect(blocked.error?.code).toBe('user_banned');

    await admin.from('profiles').update({ status: 'active' }).eq('id', user.id);
    await adminClient().auth.admin.updateUserById(user.id, { ban_duration: 'none' });

    const back = await publicClient().auth.signInWithPassword({
      email: user.email,
      password: SEED.password,
    });
    expect(back.error).toBeNull();
  });

  it('a session that was already open loses access as soon as the account is disabled', async () => {
    const user = await newUser('open-session');
    const { client } = await signedInAs(user.email);
    expect((await client.rpc('current_profile_role')).data).toBe('operator');

    const { client: admin } = await signedInAs(SEED.admin);
    await admin.from('profiles').update({ status: 'disabled' }).eq('id', user.id);

    // The JWT is still valid, but the database no longer grants any role (proxy signs them out).
    expect((await client.rpc('current_profile_role')).data).toBeNull();
  });
});

describe('password recovery of a disabled account (CA-25)', () => {
  it('sends no session: verifying the recovery link fails with user_banned', async () => {
    const { error: requestError } = await publicClient().auth.resetPasswordForEmail(SEED.disabled);
    expect(requestError).toBeNull(); // the request itself reveals nothing (RN-06)

    const { tokenHash } = confirmLinkOf((await waitForEmail(SEED.disabled)).HTML);
    const { data, error } = await publicClient().auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    });

    expect(error?.code).toBe('user_banned');
    expect(data.session).toBeNull();
  });
});
