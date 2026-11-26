// @vitest-environment node
/**
 * services.actions — an admin registers, corrects, disables and reactivates services (spec 007).
 *
 * Guards:
 * - RN-01 / CA-17: only an ACTIVE ADMIN; anyone else gets `forbidden` and nothing reaches the
 *   database. The write runs with the admin's OWN session, so RLS and the guard decide too.
 * - CA-01 / CA-05: the data sent is the normalised form output (whole pesos, null = not offered).
 * - CA-03: invalid input is refused before reaching the database.
 * - CA-04: the guard's "name taken" becomes its own message, and says when the existing service is
 *   disabled (the form then suggests reactivating it).
 * - CA-12 / CA-13: disabling writes the date, reactivating clears it.
 * - Spec 024, CA-20: what the service includes is saved after it, through set_service_inclusions
 *   (the database refuses a loop, said as its own message).
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  createService,
  setServiceDisabled,
  updateService,
} from '@web/modules/services/actions/services.actions';

import { buildProfile } from '@tests/test-utils/builders';

vi.mock('@web/modules/auth/api/auth.server', () => ({ getActiveAdmin: vi.fn() }));
vi.mock('@web/modules/core/lib/supabase-server.lib', () => ({
  createSupabaseServerClient: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const ADMIN = buildProfile({ id: 'admin-id', role: 'admin' });
const ID = '6f1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';
const NOW = new Date('2026-11-20T15:00:00Z');

const form = (overrides: Record<string, unknown> = {}) => ({
  name: 'Lavado sencillo',
  price_motorcycle: '25.000',
  price_car: '40000',
  price_bicycle: '',
  ...overrides,
});

type DbError = { code?: string; hint?: string; message: string } | null;

/**
 * The admin's own session: services insert … select … single, update … select … maybeSingle, and
 * the rpc that saves what a service includes.
 */
const fakeSession = ({
  insertError = null,
  updated = { data: { id: ID }, error: null },
  rpcError = null,
}: {
  insertError?: DbError;
  updated?: { data: unknown; error: DbError };
  rpcError?: DbError;
} = {}) => {
  const insert = vi.fn(() => ({
    select: () => ({
      single: () => Promise.resolve({ data: insertError ? null : { id: ID }, error: insertError }),
    }),
  }));
  const eq = vi.fn(() => ({ select: () => ({ maybeSingle: () => Promise.resolve(updated) }) }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ insert, update }));
  const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ from, rpc } as never);
  return { from, insert, update, eq, rpc };
};

describe('services.actions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(getActiveAdmin).mockResolvedValue(ADMIN);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it.each([
    ['createService', () => createService(form())],
    ['updateService', () => updateService({ id: ID, ...form() })],
    ['setServiceDisabled', () => setServiceDisabled({ id: ID, disabled: true })],
  ])(
    '%s refuses anyone who is not an active admin, before touching the database (CA-17)',
    async (_, run) => {
      vi.mocked(getActiveAdmin).mockResolvedValue(null);

      await expect(run()).resolves.toEqual({ ok: false, error: 'forbidden' });
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    }
  );

  it('registers a service with whole pesos, null where it is not offered (CA-01, CA-02)', async () => {
    const { from, insert } = fakeSession();

    await expect(createService(form())).resolves.toEqual({ ok: true });

    expect(from).toHaveBeenCalledWith('services');
    expect(insert).toHaveBeenCalledWith({
      name: 'Lavado sencillo',
      price_motorcycle: 25000,
      price_car: 40000,
      price_bicycle: null,
      // Spec 008, CA-26: no estimated time typed.
      estimated_minutes: null,
      // Spec 024: no values by category, not «a convenir», no description.
      motorcycle_prices: null,
      on_quote: false,
      description: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith('/services');
  });

  it('refuses invalid input before reaching the database (CA-03)', async () => {
    const { insert } = fakeSession();

    const result = await createService(form({ name: '', price_motorcycle: '', price_car: '' }));

    expect(result).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(insert).not.toHaveBeenCalled();
  });

  it.each([
    ['service_name_taken', 'nameTaken'],
    ['service_name_taken_disabled', 'nameTakenDisabled'],
  ])('reports the guard hint %s as «%s» (CA-04)', async (hint, error) => {
    fakeSession({ insertError: { code: '23505', hint, message: 'duplicate' } });

    await expect(createService(form())).resolves.toEqual({ ok: false, error });
  });

  it('corrects the name and the prices of a service (CA-05)', async () => {
    const { update, eq } = fakeSession();

    await expect(
      updateService({ id: ID, ...form({ name: 'Lavado básico', price_car: '' }) })
    ).resolves.toEqual({ ok: true });

    expect(update).toHaveBeenCalledWith({
      name: 'Lavado básico',
      price_motorcycle: 25000,
      price_car: null,
      price_bicycle: null,
      estimated_minutes: null,
      motorcycle_prices: null,
      on_quote: false,
      description: null,
    });
    expect(eq).toHaveBeenCalledWith('id', ID);
  });

  it('says so when the service to correct does not exist (or cannot be seen)', async () => {
    fakeSession({ updated: { data: null, error: null } });

    await expect(updateService({ id: ID, ...form() })).resolves.toEqual({
      ok: false,
      error: 'notFound',
    });
  });

  it('disables a service with the current date, and reactivates it by clearing it (CA-12, CA-13)', async () => {
    const { update } = fakeSession();

    await expect(setServiceDisabled({ id: ID, disabled: true })).resolves.toEqual({ ok: true });
    await expect(setServiceDisabled({ id: ID, disabled: false })).resolves.toEqual({ ok: true });

    expect(update).toHaveBeenNthCalledWith(1, { disabled_at: NOW.toISOString() });
    expect(update).toHaveBeenNthCalledWith(2, { disabled_at: null });
  });

  describe('what a service includes (spec 024, CA-20)', () => {
    const PRO_WASH = '7a1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';
    const SELLADOR = '8b1c0d2e-8a4b-4c3d-9e5f-0a1b2c3d4e5f';

    it('saves it after registering the service, by its new id, and never in the service row', async () => {
      const { insert, rpc } = fakeSession();

      await expect(createService(form({ includes: [PRO_WASH, SELLADOR] }))).resolves.toEqual({
        ok: true,
      });

      expect(insert).toHaveBeenCalledWith(
        expect.not.objectContaining({ includes: expect.anything() })
      );
      expect(rpc).toHaveBeenCalledWith('set_service_inclusions', {
        p_service_id: ID,
        p_included: [PRO_WASH, SELLADOR],
      });
    });

    it('saves it after correcting the service, also when it now includes nothing', async () => {
      const { rpc } = fakeSession();

      await updateService({ id: ID, ...form({ includes: [] }) });

      expect(rpc).toHaveBeenCalledWith('set_service_inclusions', {
        p_service_id: ID,
        p_included: [],
      });
    });

    it('says when it would include a service that already includes it', async () => {
      fakeSession({
        rpcError: { code: '23514', hint: 'service_inclusion_cycle', message: 'cycle' },
      });

      await expect(updateService({ id: ID, ...form({ includes: [PRO_WASH] }) })).resolves.toEqual({
        ok: false,
        error: 'inclusionCycle',
      });
    });
  });
});
