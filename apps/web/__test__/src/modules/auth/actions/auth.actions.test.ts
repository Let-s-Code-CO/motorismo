// @vitest-environment node
/**
 * auth.actions — setPassword, requestPasswordReset and signInWithGoogle (spec 002); signUp and
 * resendConfirmation (spec 004).
 *
 * signUp (HU-01): invalid input never reaches Auth (CA-06); the form data and the consent travel
 * as metadata (the database validates them again, RN-04) with a link back to /auth/confirm; an
 * email that already has an account gets the SAME answer as a new one (CA-07, RN-06).
 * resendConfirmation (CA-04, CA-05): same answer whatever happens, like the password recovery.
 * signIn (RF-02): after signing in, staff go to the requested page or home; a customer goes to the
 * requested page only if it is theirs, otherwise to "Mi perfil".
 *
 * requestPasswordReset (CA-22, RN-06): the answer never reveals whether an email is registered,
 * so it is the same for a registered email, an unknown one, an invalid one and an Auth failure.
 * signInWithGoogle (HU-06): sends the browser to Google with a callback back to THIS deployment,
 * carrying the page originally requested (sanitized against open redirects).
 *
 * setPassword (CA-14 / CA-23):
 *
 * Business rule: an invited person becomes "Activo" only once they have set THEIR OWN password.
 * Opening the invitation link is not enough (Auth already writes a random password at that point,
 * see supabase/tests/02_profiles_rules.test.sql), so activation is done here, after Auth stored
 * the chosen password, and only for the transition invited → active of that same user.
 */
import { redirect } from 'next/navigation';

import {
  requestPasswordReset,
  resendConfirmation,
  setPassword,
  signIn,
  signInWithGoogle,
  signUp,
} from '@web/modules/auth/actions/auth.actions';
import { createSupabaseAdminClient } from '@web/modules/core/lib/supabase-admin.lib';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('@web/modules/core/lib/supabase-admin.lib', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@web/modules/auth/api/activity.server', () => ({
  touchActivityCookie: vi.fn(),
  clearActivityCookie: vi.fn(),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@web/modules/core/utils/site-url.utils', () => ({ getSiteUrl: () => 'https://app.test' }));

const updateUser = vi.fn();
const resetPasswordForEmail = vi.fn();
const signInWithOAuth = vi.fn();
const authSignUp = vi.fn();
const resend = vi.fn();
const signInWithPassword = vi.fn();
const rpc = vi.fn();
const statusEq = vi.fn().mockResolvedValue({ error: null });
const idEq = vi.fn(() => ({ eq: statusEq }));
const update = vi.fn(() => ({ eq: idEq }));
const from = vi.fn(() => ({ update }));

vi.mocked(createSupabaseServerClient).mockResolvedValue({
  auth: {
    updateUser,
    resetPasswordForEmail,
    signInWithOAuth,
    signUp: authSignUp,
    resend,
    signInWithPassword,
  },
  rpc,
} as never);
vi.mocked(createSupabaseAdminClient).mockReturnValue({ from } as never);

const valid = { password: 'una-clave-segura', confirm: 'una-clave-segura' };

describe('setPassword', () => {
  afterEach(() => vi.clearAllMocks());

  it('stores the password, then activates the user only if still invited, and goes home (CA-14)', async () => {
    updateUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    await setPassword(valid);

    expect(updateUser).toHaveBeenCalledWith({ password: 'una-clave-segura' });
    expect(from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith({ status: 'active' });
    expect(idEq).toHaveBeenCalledWith('id', 'user-1');
    expect(statusEq).toHaveBeenCalledWith('status', 'invited');
    expect(redirect).toHaveBeenCalledWith('/');
  });

  it('does not activate anyone when Auth rejects the password', async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: { code: 'weak_password' } });

    await expect(setPassword(valid)).resolves.toEqual({ ok: false, error: 'weakPassword' });
    expect(from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters before calling Auth (RN-04)', async () => {
    await expect(setPassword({ password: '1234567', confirm: '1234567' })).resolves.toEqual({
      ok: false,
      error: 'weakPassword',
    });
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe('requestPasswordReset', () => {
  afterEach(() => vi.clearAllMocks());

  it('asks Auth for a recovery link back to this site, for a valid email (CA-22)', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });

    await expect(requestPasswordReset({ email: ' Ana@Motorismo.test ' })).resolves.toEqual({
      ok: true,
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@motorismo.test', {
      redirectTo: 'https://app.test',
    });
  });

  it('answers the same when Auth fails, so nothing can be learned about the email (RN-06)', async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { code: 'unexpected_failure' } });

    await expect(requestPasswordReset({ email: 'nadie@motorismo.test' })).resolves.toEqual({
      ok: true,
    });
  });

  it('rejects a malformed email as a field error, before calling Auth', async () => {
    await expect(requestPasswordReset({ email: 'ana' })).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
      fieldErrors: { email: ['emailInvalid'] },
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe('signInWithGoogle', () => {
  afterEach(() => vi.clearAllMocks());

  it('redirects to Google with a callback to this site that keeps the requested page (HU-06)', async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.test/o' },
      error: null,
    });

    await signInWithGoogle('/admin/users');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.test/auth/callback?next=%2Fadmin%2Fusers' },
    });
    expect(redirect).toHaveBeenCalledWith('https://accounts.google.test/o');
  });

  it('drops an unsafe requested page instead of forwarding it (open redirect)', async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.test/o' },
      error: null,
    });

    await signInWithGoogle('https://evil.example.com');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://app.test/auth/callback' },
    });
  });

  it('returns an error instead of redirecting when the provider is not available', async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { code: 'provider_disabled' },
    });

    await expect(signInWithGoogle()).resolves.toEqual({ ok: false, error: 'generic' });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe('signUp', () => {
  const input = {
    full_name: ' Camila Cliente ',
    email: 'Camila@Correo.test',
    phone: '300 123 4567',
    password: 'cliente-nuevo-1',
    data_consent: true,
  };

  afterEach(() => vi.clearAllMocks());

  it('signs up with the data and the consent as metadata and a link back to /auth/confirm (CA-02)', async () => {
    authSignUp.mockResolvedValue({ data: { user: { id: 'u' }, session: null }, error: null });

    await expect(signUp(input)).resolves.toEqual({ ok: true });
    expect(authSignUp).toHaveBeenCalledWith({
      email: 'camila@correo.test',
      password: 'cliente-nuevo-1',
      options: {
        data: { full_name: 'Camila Cliente', phone: '3001234567', data_consent: true },
        emailRedirectTo: 'https://app.test/auth/confirm',
      },
    });
  });

  it('answers the same when the email already has an account (CA-07, RN-06)', async () => {
    authSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'user_already_exists' },
    });

    await expect(signUp(input)).resolves.toEqual({ ok: true });
  });

  it('returns one error per invalid field and never calls Auth (CA-06)', async () => {
    await expect(
      signUp({ full_name: '', email: 'x', password: '1', data_consent: false })
    ).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
      fieldErrors: {
        full_name: ['fullNameRequired'],
        email: ['emailInvalid'],
        password: ['passwordTooShort'],
        data_consent: ['consentRequired'],
      },
    });
    expect(authSignUp).not.toHaveBeenCalled();
  });

  it('reports too many attempts as such', async () => {
    authSignUp.mockResolvedValue({ data: {}, error: { code: 'over_email_send_rate_limit' } });

    await expect(signUp(input)).resolves.toEqual({ ok: false, error: 'rateLimited' });
  });

  it('reports any other failure as generic', async () => {
    authSignUp.mockResolvedValue({ data: {}, error: { code: 'unexpected_failure' } });

    await expect(signUp(input)).resolves.toEqual({ ok: false, error: 'generic' });
  });
});

describe('resendConfirmation', () => {
  afterEach(() => vi.clearAllMocks());

  it('re-sends the confirmation email with a link back to /auth/confirm (CA-04)', async () => {
    resend.mockResolvedValue({ error: null });

    await expect(resendConfirmation(' Camila@Correo.test ')).resolves.toEqual({ ok: true });
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'camila@correo.test',
      options: { emailRedirectTo: 'https://app.test/auth/confirm' },
    });
  });

  it.each([
    ['Auth fails', { error: { code: 'unexpected_failure' } }],
    ['the email has no pending sign-up', { error: null }],
  ])('answers the same when %s (RN-06)', async (_case, outcome) => {
    resend.mockResolvedValue(outcome);

    await expect(resendConfirmation('camila@correo.test')).resolves.toEqual({ ok: true });
  });

  it('does not call Auth for an invalid email', async () => {
    await expect(resendConfirmation('camila')).resolves.toEqual({ ok: true });
    expect(resend).not.toHaveBeenCalled();
  });
});

describe('signIn', () => {
  afterEach(() => vi.clearAllMocks());

  const credentials = { email: 'cliente@motorismo.test', password: 'motorismo-local' };

  // Spec 011, CA-12: on success it answers where to go instead of redirecting, so the form can
  // show the brand while that page loads; the destination is still decided here, on the server.
  it('sends a customer who asked for a staff page to their profile (spec 004, RF-02)', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: [{ kind: 'customer', role: null, status: 'active' }] });

    await expect(signIn(credentials, '/customers')).resolves.toEqual({
      ok: true,
      destination: '/profile',
    });
    expect(rpc).toHaveBeenCalledWith('current_account');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends staff to the page they asked for (CA-03)', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: [{ kind: 'staff', role: 'admin', status: 'active' }] });

    await expect(signIn(credentials, '/customers')).resolves.toEqual({
      ok: true,
      destination: '/customers',
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('never sends anyone to another site: an unsafe requested page goes home (open redirect)', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: [{ kind: 'staff', role: 'admin', status: 'active' }] });

    await expect(signIn(credentials, 'https://evil.example.com')).resolves.toEqual({
      ok: true,
      destination: '/',
    });
  });

  it('does not redirect when the credentials are wrong (CA-02)', async () => {
    signInWithPassword.mockResolvedValue({ error: { code: 'invalid_credentials' } });

    await expect(signIn(credentials, '/customers')).resolves.toEqual({
      ok: false,
      error: 'invalidCredentials',
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
