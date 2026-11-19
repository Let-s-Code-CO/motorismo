/**
 * Customer sign-up against the real local Auth + database (spec 004, HU-01).
 *
 * Guards what mocks cannot:
 * - CA-02: signing up sends a Spanish confirmation email with a /auth/confirm link and opens no
 *   session.
 * - CA-19 / RN-07: until the email is confirmed the person is not a customer (no record).
 * - CA-03: opening the link opens a session and creates the customer (origin "self_signup").
 * - CA-04: with the RIGHT password an unconfirmed person is told to confirm (email_not_confirmed);
 *   with a wrong one they get the usual invalid credentials (RN-06), and the confirmation email can
 *   be re-sent.
 * - CA-07: signing up again with an email that already has an account changes nothing (Auth answers
 *   user_already_exists, which the app turns into the usual "check your email", RN-06).
 * - RN-11: a sign-up whose metadata claims role "admin" becomes a customer, never staff.
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

const PASSWORD = 'cliente-nuevo-1';
const created: string[] = [];

const signUp = (email: string, data: Record<string, unknown> = {}) => {
  created.push(email);
  return publicClient().auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { full_name: 'Camila Nueva', data_consent: true, ...data } },
  });
};

const customerByEmail = async (email: string) => {
  const { data } = await adminClient()
    .from('customers')
    .select('user_id, full_name, phone, origin, status')
    .eq('email', email)
    .maybeSingle();
  return data;
};

afterAll(() => deleteUsersByEmail(created));

describe('signing up with email and password', () => {
  it('sends the Spanish confirmation email and opens no session (CA-02)', async () => {
    const email = uniqueEmail('signup');

    const { data, error } = await signUp(email, { phone: '300 123 4567' });

    expect(error).toBeNull();
    expect(data.session).toBeNull();
    const message = await waitForEmail(email);
    expect(message.Subject).toBe('Confirma tu cuenta de Motorismo Detailing');
    expect(confirmLinkOf(message.HTML).type).toBe('email');
  });

  it('is not a customer until the email is confirmed, and is one afterwards (CA-19, CA-03)', async () => {
    const email = uniqueEmail('confirm');
    await signUp(email, { phone: '+57 311 222 3344' });
    expect(await customerByEmail(email)).toBeNull();

    const { tokenHash } = confirmLinkOf((await waitForEmail(email)).HTML);
    const client = publicClient();
    const { data, error } = await client.auth.verifyOtp({ type: 'email', token_hash: tokenHash });

    expect(error).toBeNull();
    expect(data.session).not.toBeNull();
    expect(await customerByEmail(email)).toEqual({
      user_id: data.user!.id,
      full_name: 'Camila Nueva',
      phone: '3112223344',
      origin: 'self_signup',
      status: 'registered',
    });
  });

  it('tells an unconfirmed person to confirm only with the right password, and re-sends the email (CA-04)', async () => {
    const email = uniqueEmail('unconfirmed');
    await signUp(email);
    const first = await waitForEmail(email);

    const right = await publicClient().auth.signInWithPassword({ email, password: PASSWORD });
    const wrong = await publicClient().auth.signInWithPassword({ email, password: 'otra-clave-1' });
    expect(right.error?.code).toBe('email_not_confirmed');
    expect(wrong.error?.code).toBe('invalid_credentials');

    // Auth allows one email per second per address (max_frequency).
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const { error } = await publicClient().auth.resend({ type: 'signup', email });
    expect(error).toBeNull();
    const second = await waitForEmail(email, { after: first.ID });
    expect(confirmLinkOf(second.HTML).tokenHash).not.toBe(confirmLinkOf(first.HTML).tokenHash);
  });

  it('changes nothing when the email already has an account (CA-07)', async () => {
    created.pop(); // the seed customer must survive this suite
    const { error } = await publicClient().auth.signUp({
      email: SEED.customer,
      password: 'otra-clave-1',
      options: { data: { full_name: 'Intruso', data_consent: true } },
    });

    expect(error?.code).toBe('user_already_exists');
    expect((await customerByEmail(SEED.customer))?.full_name).toBe('Camila Cliente');
    const login = await publicClient().auth.signInWithPassword({
      email: SEED.customer,
      password: SEED.password,
    });
    expect(login.error).toBeNull();
  });

  it('never turns a sign-up into staff, even if its metadata claims role admin (RN-11)', async () => {
    const email = uniqueEmail('wannabe');
    await signUp(email, { role: 'admin' });
    const { tokenHash } = confirmLinkOf((await waitForEmail(email)).HTML);
    const { data } = await publicClient().auth.verifyOtp({ type: 'email', token_hash: tokenHash });

    const { data: profile } = await adminClient()
      .from('profiles')
      .select('id')
      .eq('id', data.user!.id)
      .maybeSingle();
    expect(profile).toBeNull();
    expect((await customerByEmail(email))?.status).toBe('registered');
  });
});
