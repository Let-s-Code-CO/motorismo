// @vitest-environment node
/**
 * payroll.actions — the admin closes and regenerates a fortnight's payroll (spec 020, HU-03; by
 * month in spec 016).
 *
 * Guards:
 * - spec 016, RN-08: only an ACTIVE ADMIN; anyone else gets `forbidden` and nothing reaches the
 *   database (whose functions refuse them too).
 * - CA-11, CA-16: the fortnight goes to close_payroll / regenerate_payroll by its first day, with the
 *   method chosen; anything that is not a fortnight's first day (the 1st or the 16th) or one of the
 *   two methods is refused before reaching the database.
 * - The database's refusals become their own message: a fortnight not ended yet (RN-04), not a
 *   fortnight, one already closed, one not closed to regenerate, a method it does not know.
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
    ['closePayroll', () => closePayroll({ start: '2026-10-16', method: 'actual' })],
    ['regeneratePayroll', () => regeneratePayroll({ start: '2026-10-16', method: 'actual' })],
  ])(
    '%s refuses anyone who is not an active admin, before touching the database (RN-08)',
    async (_, run) => {
      vi.mocked(getActiveAdmin).mockResolvedValue(null);

      await expect(run()).resolves.toEqual({ ok: false, error: 'forbidden' });
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    }
  );

  it('closes the fortnight by its first day, with the method chosen, and renders the payroll again (CA-11, CA-16)', async () => {
    const { rpc } = fakeSession();

    await expect(closePayroll({ start: '2026-10-16', method: 'actual' })).resolves.toEqual({
      ok: true,
    });

    expect(rpc).toHaveBeenCalledWith('close_payroll', {
      p_start: '2026-10-16',
      p_method: 'actual',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/reports/payroll', 'layout');
  });

  it('regenerates the fortnight with the method chosen now (CA-12, CA-16)', async () => {
    const { rpc } = fakeSession();

    await expect(regeneratePayroll({ start: '2026-10-16', method: 'actual' })).resolves.toEqual({
      ok: true,
    });

    expect(rpc).toHaveBeenCalledWith('regenerate_payroll', {
      p_start: '2026-10-16',
      p_method: 'actual',
    });
  });

  it.each([
    ['a day that is not the 1st nor the 16th', { start: '2026-10-05', method: 'actual' }],
    ['a day that does not exist', { start: '2026-02-30', method: 'actual' }],
    ['a month', { start: '2026-10', method: 'actual' }],
    ['no day', { method: 'actual' }],
    ['an unknown method', { start: '2026-10-16', method: 'weekly' }],
    ['no method', { start: '2026-10-16' }],
  ])('refuses %s before reaching the database', async (_, input) => {
    fakeSession();

    await expect(closePayroll(input)).resolves.toEqual({
      ok: false,
      error: 'invalidInput',
    });
    expect(createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it.each([
    ['payroll_period_open', 'periodOpen', closePayroll],
    ['payroll_not_fortnight', 'notFortnight', closePayroll],
    ['payroll_method_invalid', 'methodInvalid', closePayroll],
    ['payroll_already_closed', 'alreadyClosed', closePayroll],
    ['payroll_not_closed', 'notClosed', regeneratePayroll],
    ['payroll_admin_only', 'forbidden', closePayroll],
  ] as const)(
    'turns the database refusal «%s» into «%s» (RN-04, CA-11, CA-12)',
    async (hint, error, run) => {
      fakeSession({
        hint,
        message: 'refused',
        code: hint === 'payroll_admin_only' ? '42501' : 'P0001',
      });

      await expect(run({ start: '2026-10-16', method: 'actual' })).resolves.toEqual({
        ok: false,
        error,
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );

  it('says «generic» for any other failure', async () => {
    fakeSession({ message: 'connection lost' });

    await expect(closePayroll({ start: '2026-10-16', method: 'actual' })).resolves.toEqual({
      ok: false,
      error: 'generic',
    });
  });
});
