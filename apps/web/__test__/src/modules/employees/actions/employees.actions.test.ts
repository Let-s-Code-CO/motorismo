// @vitest-environment node
/**
 * employees.actions — an admin registers, corrects, disables and reactivates employees (spec 007).
 *
 * Guards:
 * - RN-01 / CA-17: only an ACTIVE ADMIN; anyone else gets `forbidden` and nothing reaches the
 *   database. The write runs with the admin's OWN session (save_employee is SECURITY INVOKER),
 *   so RLS and the guard decide too.
 * - CA-07 / CA-10: registering and correcting send the normalised data to save_employee, which
 *   writes the name and the private details together.
 * - CA-08: invalid input is refused before reaching the database.
 * - CA-09: the guard's "document taken" becomes its own message, and says when the existing
 *   employee is disabled (the form then suggests reactivating them).
 * - CA-12 / CA-13: disabling writes the date, reactivating clears it.
 */
import { revalidatePath } from 'next/cache';

import { getActiveAdmin } from '@web/modules/auth/api/auth.server';
import { createSupabaseServerClient } from '@web/modules/core/lib/supabase-server.lib';
import {
  saveEmployee,
  setEmployeeDisabled,
} from '@web/modules/employees/actions/employees.actions';

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
  full_name: 'Elkin Estrada',
  document_type: 'cc',
  document_number: '1.020.304.050',
  phone: '300 111 2233',
  commission_pct: '35',
  ...overrides,
});

type DbError = { code?: string; hint?: string; message: string } | null;

/** The admin's own session: rpc('save_employee') and employees update … select … maybeSingle. */
const fakeSession = ({
  rpcError = null,
  updated = { data: { id: ID }, error: null },
}: { rpcError?: DbError; updated?: { data: unknown; error: DbError } } = {}) => {
  const rpc = vi.fn().mockResolvedValue({ data: ID, error: rpcError });
  const eq = vi.fn(() => ({ select: () => ({ maybeSingle: () => Promise.resolve(updated) }) }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  vi.mocked(createSupabaseServerClient).mockResolvedValue({ rpc, from } as never);
  return { rpc, from, update, eq };
};

describe('employees.actions', () => {
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
    ['saveEmployee', () => saveEmployee(form())],
    ['setEmployeeDisabled', () => setEmployeeDisabled({ id: ID, disabled: true })],
  ])(
    '%s refuses anyone who is not an active admin, before touching the database (CA-17)',
    async (_, run) => {
      vi.mocked(getActiveAdmin).mockResolvedValue(null);

      await expect(run()).resolves.toEqual({ ok: false, error: 'forbidden' });
      expect(createSupabaseServerClient).not.toHaveBeenCalled();
    }
  );

  it('registers an employee through save_employee, with the normalised data (CA-07)', async () => {
    const { rpc } = fakeSession();

    await expect(saveEmployee(form())).resolves.toEqual({ ok: true });

    // No p_id: a new employee (the function's default).
    expect(rpc).toHaveBeenCalledWith('save_employee', {
      p_full_name: 'Elkin Estrada',
      p_document_type: 'cc',
      p_document_number: '1020304050',
      p_commission_pct: 35,
      p_phone: '3001112233',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/employees');
  });

  it('corrects an employee by id (CA-10)', async () => {
    const { rpc } = fakeSession();

    await saveEmployee({ id: ID, ...form({ commission_pct: '40', phone: '' }) });

    // No p_phone: the phone is cleared (the function's default is null).
    expect(rpc).toHaveBeenCalledWith('save_employee', {
      p_full_name: 'Elkin Estrada',
      p_document_type: 'cc',
      p_document_number: '1020304050',
      p_commission_pct: 40,
      p_id: ID,
    });
  });

  it('refuses invalid input before reaching the database (CA-08)', async () => {
    const { rpc } = fakeSession();

    const result = await saveEmployee(form({ commission_pct: '101' }));

    expect(result).toMatchObject({ ok: false, error: 'invalidInput' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['employee_document_taken', 'documentTaken'],
    ['employee_document_taken_disabled', 'documentTakenDisabled'],
    ['employee_not_found', 'notFound'],
  ])('reports the database hint %s as «%s» (CA-09)', async (hint, error) => {
    fakeSession({ rpcError: { code: '23505', hint, message: 'refused' } });

    await expect(saveEmployee(form())).resolves.toEqual({ ok: false, error });
  });

  it('disables an employee with the current date, and reactivates them by clearing it (CA-12, CA-13)', async () => {
    const { from, update } = fakeSession();

    await expect(setEmployeeDisabled({ id: ID, disabled: true })).resolves.toEqual({ ok: true });
    await expect(setEmployeeDisabled({ id: ID, disabled: false })).resolves.toEqual({ ok: true });

    expect(from).toHaveBeenCalledWith('employees');
    expect(update).toHaveBeenNthCalledWith(1, { disabled_at: NOW.toISOString() });
    expect(update).toHaveBeenNthCalledWith(2, { disabled_at: null });
  });
});
