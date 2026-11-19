// @vitest-environment node
/**
 * auth.actions — setPassword, requestPasswordReset and signInWithGoogle (spec 002).
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
  setPassword,
  signInWithGoogle,
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
const statusEq = vi.fn().mockResolvedValue({ error: null });
const idEq = vi.fn(() => ({ eq: statusEq }));
const update = vi.fn(() => ({ eq: idEq }));
const from = vi.fn(() => ({ update }));

vi.mocked(createSupabaseServerClient).mockResolvedValue({
  auth: { updateUser, resetPasswordForEmail, signInWithOAuth },
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
