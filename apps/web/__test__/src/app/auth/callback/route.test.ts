// @vitest-environment node
/**
 * GET /auth/callback — where Google sends the user back (spec 002, HU-06; spec 004, HU-05).
 *
 * Guards:
 * - CA-26: a successful sign-in opens the session, starts the inactivity clock and goes to the
 *   requested page (sanitized) or home.
 * - Spec 004, RF-02: a customer (e.g. a new Google account, CA-20) only goes to the requested page
 *   if it is theirs; otherwise to "Mi perfil".
 * - Any error reported by Google or Auth lands on the login with its code (spec 004 replaced
 *   spec 002's CA-27: unknown Google accounts are no longer refused, they become customers).
 * - CA-28: a disabled account lands on the login with the disabled-account message.
 */
import { NextRequest } from 'next/server';

import { GET } from '@web/app/auth/callback/route';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));

const exchangeCodeForSession = vi.fn();
const rpc = vi
  .fn()
  .mockResolvedValue({ data: [{ kind: 'staff', role: 'admin', status: 'active' }] });
vi.mocked(createSupabaseServerClient).mockResolvedValue({
  auth: { exchangeCodeForSession },
  rpc,
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

  it('sends a customer who asked for a staff page to their own home (spec 004, RF-02; spec 014)', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    rpc.mockResolvedValueOnce({ data: [{ kind: 'customer', role: null, status: 'active' }] });

    const response = await GET(request('?code=xyz&next=%2Fcustomers'));

    expect(locationOf(response)).toBe('/my');
  });

  it('passes an error reported by Google on to the login', async () => {
    const response = await GET(
      request('?error=access_denied&error_code=access_denied&error_description=Cancelled')
    );

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe('/auth/login?error=access_denied');
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
