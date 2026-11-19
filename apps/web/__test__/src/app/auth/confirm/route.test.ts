// @vitest-environment node
/**
 * GET /auth/confirm — where invitation and recovery emails land (spec 002).
 *
 * Guards:
 * - CA-14 / CA-23: a valid link opens a session and leads to "create your password", and starts
 *   the inactivity clock (activity cookie).
 * - CA-15 / CA-24: an expired, used or malformed link leads to the "invalid link" page for its
 *   type, so the page can tell an invited person to ask for a new invitation and a user who
 *   forgot their password to request a new link.
 * - CA-25: a disabled account that follows a recovery link gets no session and is told its account
 *   is disabled (not that the link expired).
 */
import { NextRequest } from 'next/server';

import { GET } from '@web/app/auth/confirm/route';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';

vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));

const verifyOtp = vi.fn();
vi.mocked(createSupabaseServerClient).mockResolvedValue({ auth: { verifyOtp } } as never);

const request = (query: string) => new NextRequest(`http://localhost:3000/auth/confirm${query}`);
const locationOf = (response: Response) =>
  new URL(response.headers.get('location')!).pathname +
  new URL(response.headers.get('location')!).search;

describe('GET /auth/confirm', () => {
  afterEach(() => verifyOtp.mockReset());

  it.each(['invite', 'recovery'])(
    'verifies a valid %s link and leads to "create your password" with the activity clock started',
    async (type) => {
      verifyOtp.mockResolvedValue({ error: null });

      const response = await GET(request(`?token_hash=abc&type=${type}`));

      expect(verifyOtp).toHaveBeenCalledWith({ type, token_hash: 'abc' });
      expect(locationOf(response)).toBe('/auth/set-password');
      expect(response.headers.get('set-cookie')).toContain('mt_last_seen=');
    }
  );

  it.each(['invite', 'recovery'])(
    'sends an expired or used %s link to the invalid-link page for that type (CA-15, CA-24)',
    async (type) => {
      verifyOtp.mockResolvedValue({ error: { code: 'otp_expired', message: 'expired' } });

      const response = await GET(request(`?token_hash=abc&type=${type}`));

      expect(locationOf(response)).toBe(`/auth/invalid-link?type=${type}`);
      expect(response.headers.get('set-cookie')).toBeNull();
    }
  );

  it('sends a disabled account to the login with the disabled message (CA-25)', async () => {
    verifyOtp.mockResolvedValue({ error: { code: 'user_banned', message: 'banned' } });

    const response = await GET(request('?token_hash=abc&type=recovery'));

    expect(locationOf(response)).toBe('/auth/login?error=account_disabled');
  });

  it('rejects a link without token, without calling Auth', async () => {
    const response = await GET(request('?type=invite'));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe('/auth/invalid-link?type=invite');
  });

  it('rejects an unknown link type, without calling Auth', async () => {
    const response = await GET(request('?token_hash=abc&type=magiclink2'));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe('/auth/invalid-link');
  });
});
