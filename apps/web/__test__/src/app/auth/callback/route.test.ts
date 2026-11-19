// @vitest-environment node
/**
 * GET /auth/callback — where Google sends the user back (spec 002, HU-06).
 *
 * Guards:
 * - CA-26: a successful sign-in opens the session, starts the inactivity clock and goes to the
 *   requested page (sanitized) or home.
 * - CA-27: a Google account that does not belong to any user is refused by Auth (sign-ups are
 *   disabled) and lands on the login with "Esta cuenta de Google no tiene acceso…".
 * - CA-28: a disabled account lands on the login with the disabled-account message.
 */
import { NextRequest } from 'next/server';

import { GET } from '@web/app/auth/callback/route';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));

const exchangeCodeForSession = vi.fn();
vi.mocked(createSupabaseServerClient).mockResolvedValue({
  auth: { exchangeCodeForSession },
} as never);

const request = (query: string) => new NextRequest(`http://localhost:3000/auth/callback${query}`);
const locationOf = (response: Response) => {
  const url = new URL(response.headers.get('location')!);
  return url.pathname + url.search;
};

describe('GET /auth/callback', () => {
  afterEach(() => exchangeCodeForSession.mockReset());

  it('opens the session and goes to the requested page (CA-26)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(request('?code=xyz&next=%2Fadmin%2Fusers'));

    expect(exchangeCodeForSession).toHaveBeenCalledWith('xyz');
    expect(locationOf(response)).toBe('/admin/users');
    expect(response.headers.get('set-cookie')).toContain('mt_last_seen=');
  });

  it('goes home when the requested page is unsafe', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const response = await GET(request('?code=xyz&next=https%3A%2F%2Fevil.example.com'));

    expect(locationOf(response)).toBe('/');
  });

  it('refuses an unknown Google account with its own message (CA-27)', async () => {
    const response = await GET(
      request(
        '?error=access_denied&error_code=signup_disabled&error_description=Signups+not+allowed'
      )
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe('/auth/login?error=signup_disabled');
  });

  it('refuses a disabled account (CA-28)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: 'user_banned', message: 'banned' } });

    const response = await GET(request('?code=xyz'));

    expect(locationOf(response)).toBe('/auth/login?error=user_banned');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('treats a callback without code nor error as a generic failure', async () => {
    const response = await GET(request(''));

    expect(locationOf(response)).toBe('/auth/login?error=oauth_failed');
  });
});
