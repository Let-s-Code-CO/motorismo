// @vitest-environment node
/**
 * plate-cities.actions — an admin sets or clears a municipality's legend for its plates (spec 023,
 * CA-10, CA-11).
 *
 * Only an active admin; the database checks it again and refuses a municipality that issues no plates
 * or a legend that does not fit, with a reason the screen says.
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import { setPlateLegend } from '@web/modules/vehicles/actions/plate-cities.actions';

import { buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({ getActiveAdmin: vi.fn() }));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const fakeSession = (error: { code?: string; hint?: string; message: string } | null = null) => {
  const rpc = vi.fn(() => Promise.resolve({ data: null, error }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc } as never);
  return rpc;
};

describe('setPlateLegend', () => {
  beforeEach(() => vi.mocked(getActiveAdmin).mockResolvedValue(buildProfile({ role: 'admin' })));
  afterEach(() => vi.clearAllMocks());

  it('sets the legend, raised to capitals, and refreshes the cities (CA-10)', async () => {
    const rpc = fakeSession();

    await expect(setPlateLegend({ code: '11001', legend: 'stfe de bogota' })).resolves.toEqual({
      ok: true,
    });
    expect(rpc).toHaveBeenCalledWith('set_plate_legend', {
      p_code: '11001',
      p_legend: 'STFE DE BOGOTA',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/vehicle-catalog', 'layout');
  });

  it('clears it with an empty legend (CA-10)', async () => {
    const rpc = fakeSession();

    await setPlateLegend({ code: '11001', legend: '' });

    expect(rpc).toHaveBeenCalledWith('set_plate_legend', { p_code: '11001', p_legend: null });
  });

  it('refuses anyone who is not an active admin, before asking the database (CA-11)', async () => {
    vi.mocked(getActiveAdmin).mockResolvedValue(null);
    const rpc = fakeSession();

    await expect(setPlateLegend({ code: '11001', legend: 'X' })).resolves.toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns one error per invalid field and sends nothing', async () => {
    const rpc = fakeSession();

    const result = await setPlateLegend({ code: '11001', legend: 'BOGOTÁ' });

    expect(result).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['plate_admin_only', 'forbidden'],
    ['plate_city_not_issuing', 'notIssuing'],
    ['plate_legend_invalid', 'invalidInput'],
    ['something_else', 'generic'],
  ])('says why the database refused (%s → %s)', async (hint, error) => {
    fakeSession({ hint, message: 'x' });

    await expect(setPlateLegend({ code: '11001', legend: 'X' })).resolves.toEqual({
      ok: false,
      error,
    });
  });
});
