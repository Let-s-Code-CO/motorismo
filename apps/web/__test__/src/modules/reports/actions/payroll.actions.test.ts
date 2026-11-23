// @vitest-environment node
/**
 * payroll.actions — the admin closes and regenerates a month's payroll (spec 016, HU-03).
 *
 * Guards:
 * - CA-20 / RN-08: only an ACTIVE ADMIN; anyone else gets `forbidden` and nothing reaches the
 *   database (whose functions refuse them too).
 * - CA-14 / CA-16: the month goes to close_payroll / regenerate_payroll by its first day; anything
 *   that is not a month is refused before reaching the database.
 * - The database's refusals become their own message: a month not ended yet (RN-06), one already
 *   closed, one not closed to regenerate.
 * - After it, the payroll screen is rendered again.
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { closePayroll, regeneratePayroll } from '@web/modules/reports/actions/payroll.actions';

import { buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({ getActiveAdmin: vi.fn() }));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const ADMIN = buildProfile({ id: 'admin-id', role: 'admin' });

type DbError = { code?: string; hint?: string; message: string } | null;

const fakeSession = (error: DbError = null) => {
  const rpc = vi.fn().mockResolvedValue({ data: 'payroll-id', error });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return { rpc };
};

describe('payroll.actions', () => {
  beforeEach(() => vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN));
  afterEach(() => vi.clearAllMocks());

  it.each([
    ['closePayroll', () => closePayroll({ month: '2026-10' })],
    ['regeneratePayroll', () => regeneratePayroll({ month: '2026-10' })],
  ])(
    '%s refuses anyone who is not an active admin, before touching the database (CA-20)',
    async (_, run) => {
      vi.mocked(getActiveAdmin).mockResolvedValue(null);

      await expect(run()).resolves.toEqual({ ok: false, error: 'forbidden' });
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    }
  );

  it('closes the month by its first day and renders the payroll again (CA-14)', async () => {
    const { rpc } = fakeSession();

    await expect(closePayroll({ month: '2026-10' })).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith('close_payroll', { p_month: '2026-10-01' });
    expect(revalidatePath).toHaveBeenCalledWith('/reports/payroll', 'layout');
  });

  it('regenerates the month by its first day (CA-16)', async () => {
    const { rpc } = fakeSession();

    await expect(regeneratePayroll({ month: '2026-10' })).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith('regenerate_payroll', { p_month: '2026-10-01' });
  });

  it.each([['2026-13'], ['octubre'], ['2026-10-05'], [undefined]])(
    'refuses «%s» as a month before reaching the database',
    async (month) => {
      fakeSession();

      await expect(closePayroll({ month })).resolves.toEqual({
        ok: false,
        error: 'invalidInput',
      });
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['payroll_month_open', 'monthOpen', closePayroll],
    ['payroll_already_closed', 'alreadyClosed', closePayroll],
    ['payroll_not_closed', 'notClosed', regeneratePayroll],
    ['payroll_admin_only', 'forbidden', closePayroll],
  ] as const)(
    'turns the database refusal «%s» into «%s» (RN-06, CA-14, CA-16)',
    async (hint, error, run) => {
      fakeSession({
        hint,
        message: 'refused',
        code: hint === 'payroll_admin_only' ? '42501' : 'P0001',
      });

      await expect(run({ month: '2026-10' })).resolves.toEqual({ ok: false, error });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );

  it('says «generic» for any other failure', async () => {
    fakeSession({ message: 'connection lost' });

    await expect(closePayroll({ month: '2026-10' })).resolves.toEqual({
      ok: false,
      error: 'generic',
    });
  });
});
