/**
 * Invitations against the real local Auth (spec 002, HU-03).
 *
 * Guards what mocks cannot:
 * - CA-11 / plan risk 1: with public sign-up DISABLED, the admin API still invites; the database
 *   trigger creates an "invited" profile from the metadata; the email is in Spanish and links to
 *   the app's /auth/confirm route.
 * - Why the app checks duplicates itself (CA-12): Auth RE-SENDS the invitation to an unconfirmed
 *   email instead of failing, and only fails (email_exists) for a confirmed user.
 * - CA-16: re-sending issues a new link and the previous one stops working.
 */
import {
  SEED,
  adminClient,
  confirmLinkOf,
  deleteUsersByEmail,
  publicClient,
  uniqueEmail,
  waitForEmail,
} from './support/sandbox';

const created: string[] = [];

const invite = (email: string) => {
  created.push(email);
  return adminClient().auth.admin.inviteUserByEmail(email, {
    data: { full_name: 'Iván Invitado', role: 'operator' },
  });
};

afterAll(() => deleteUsersByEmail(created));

describe('invitations', () => {
  it('creates an invited profile and sends a Spanish email linking to /auth/confirm (CA-11)', async () => {
    const email = uniqueEmail('invite');

    const { error } = await invite(email);

    expect(error).toBeNull();
    const { data: profile } = await adminClient()
      .from('profiles')
      .select('full_name, role, status')
      .eq('email', email)
      .single();
    expect(profile).toEqual({ full_name: 'Iván Invitado', role: 'operator', status: 'invited' });

    const message = await waitForEmail(email);
    expect(message.Subject).toBe('Te invitaron a Motorismo Detailing');
    expect(confirmLinkOf(message.HTML)).toMatchObject({ type: 'invite' });
  });

  it('re-sends (does not fail) when the email belongs to a user who has not accepted yet', async () => {
    const email = uniqueEmail('reinvite');
    await invite(email);

    const { error } = await invite(email);

    // This is why inviteUser checks duplicates itself before calling Auth (CA-12).
    expect(error).toBeNull();
    const { count } = await adminClient()
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('email', email);
    expect(count).toBe(1);
  });

  it('fails with email_exists for a user who already has an account', async () => {
    const { error } = await adminClient().auth.admin.inviteUserByEmail(SEED.operator, {
      data: { full_name: 'Duplicado', role: 'operator' },
    });

    expect(error?.code).toBe('email_exists');
  });

  it('re-sending issues a new link and the previous one stops working (CA-16)', async () => {
    const email = uniqueEmail('resend');
    await invite(email);
    const first = await waitForEmail(email);

    // Auth throttles emails to the same address for 1 s (auth.email.max_frequency).
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await invite(email);
    const second = await waitForEmail(email, { after: first.ID });

    const oldLink = confirmLinkOf(first.HTML);
    const newLink = confirmLinkOf(second.HTML);
    expect(newLink.tokenHash).not.toBe(oldLink.tokenHash);

    const oldResult = await publicClient().auth.verifyOtp({
      type: 'invite',
      token_hash: oldLink.tokenHash,
    });
    expect(oldResult.error?.code).toBe('otp_expired');

    const newResult = await publicClient().auth.verifyOtp({
      type: 'invite',
      token_hash: newLink.tokenHash,
    });
    expect(newResult.error).toBeNull();
  });
});
